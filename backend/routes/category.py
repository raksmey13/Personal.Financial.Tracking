from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from sqlmodel import select
from database import SessionDep
from models import Category
# If you have a separate schema file, import from there instead
from pydantic import BaseModel

router = APIRouter(prefix="/categories", tags=["Categories"])


# 📋 Schema validation for Incoming payloads
class CategoryCreateUpdate(BaseModel):
    name: str
    type: str = "expense"
    icon: str = "tag"
    parent_id: Optional[int] = None  # 🚀 New field allowed in payloads


@router.post("/", response_model=Category)
def create_category(payload: CategoryCreateUpdate, session: SessionDep):
    # If the user tries to assign a parent, verify that parent category exists
    if payload.parent_id:
        parent = session.get(Category, payload.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Nested subcategories beyond 1 level are not permitted")

    # 🔒 CRITICAL SYSTEM SAFEGUARD: Intercept write payloads
    final_type = payload.type
    if payload.name.strip().lower() == "sweep saving":
        final_type = "transfer"

    try:
        new_cat = Category(
            name=payload.name,
            type=final_type, # 💡 Overridden if it's Sweep Saving
            icon=payload.icon,
            parent_id=payload.parent_id  # 🚀 Store the relationship link
        )
        session.add(new_cat)
        session.commit()
        session.refresh(new_cat)
        return new_cat
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database Insert Error: {str(e)}")


@router.get("/", response_model=List[Category])
def read_categories(session: SessionDep,
                    tree_format: bool = Query(False, description="Format response as a nested tree hierarchy")):
    # Fetch all active categories sorted by id
    categories = session.exec(
        select(Category)
        .where(Category.is_active == True)
        .order_by(Category.id)
    ).all()

    # 🔒 CRITICAL SYSTEM SAFEGUARD: Normalize type before formatting or rendering
    for cat in categories:
        if cat.name.strip().lower() == "sweep saving":
            cat.type = "transfer"

    # Optional query flag: if frontend wants a constructed tree object instead of a flat list
    if tree_format:
        # Build mapping index mapping items cleanly
        main_categories = [c.model_dump() for c in categories if c.parent_id is None]
        for main in main_categories:
            main["subcategories"] = [c.model_dump() for c in categories if c.parent_id == main["id"]]
        return main_categories

    return categories


@router.put("/{category_id}", response_model=Category)
def update_category(category_id: int, payload: CategoryCreateUpdate, session: SessionDep):
    db_cat = session.get(Category, category_id)
    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # Cyclic loop defense: Don't let a category become its own parent
    if payload.parent_id == category_id:
        raise HTTPException(status_code=400, detail="A category cannot be its own parent layout reference")

    if payload.parent_id:
        parent = session.get(Category, payload.parent_id)
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    # 🔒 CRITICAL SYSTEM SAFEGUARD: Intercept update payloads
    final_type = payload.type
    if payload.name.strip().lower() == "sweep saving":
        final_type = "transfer"

    db_cat.name = payload.name
    db_cat.type = final_type # 💡 Overridden if it's Sweep Saving
    db_cat.icon = payload.icon
    db_cat.parent_id = payload.parent_id  # 🚀 Updatable reference tracking

    session.add(db_cat)
    session.commit()
    session.refresh(db_cat)
    return db_cat


@router.delete("/{category_id}")
def delete_category(category_id: int, session: SessionDep):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Soft-delete the category
    category.is_active = False
    session.add(category)

    # 🧠 Clean design: If we delete a main category, orphan its subcategories safely
    subcategories = session.exec(select(Category).where(Category.parent_id == category_id)).all()
    for sub in subcategories:
        sub.parent_id = None
        session.add(sub)

    session.commit()
    return {"message": "Category soft-deleted successfully, dependent sub-elements cleared"}