import sys
import os
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from sqlmodel import select, func
from pydantic import BaseModel

# Safe path injection to keep project environment stable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionDep
from models import Category, User
from .auth import get_current_user  # 🟢 RELATIVE IMPORT MATCHING YOUR FOLDER STRUCTURE

router = APIRouter(prefix="/categories", tags=["Categories"])


# 📋 Schema validation for Incoming payloads
class CategoryCreateUpdate(BaseModel):
    name: str
    type: str = "expense"
    icon: str = "tag"
    parent_id: Optional[int] = None


@router.post("/", response_model=Category)
def create_category(
    payload: CategoryCreateUpdate,
    session: SessionDep,
    current_user: User = Depends(get_current_user)  # 🟢 DYNAMIC USER CONTEXT
):
    # If the user tries to assign a parent, verify parent category exists AND belongs to this user
    if payload.parent_id:
        parent = session.exec(
            select(Category).where(
                Category.id == payload.parent_id,
                Category.user_id == current_user.id
            )
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        # Enforce strict 1-level hierarchy
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Nested subcategories beyond 1 level are not permitted")

    # 🔒 CRITICAL ENGINE SAFEGUARD: Intercept write payloads for 50/30/20 sweep targets
    final_type = payload.type
    name_lower = payload.name.strip().lower()
    if name_lower == "sweep saving" or "sweep" in name_lower:
        final_type = "transfer"  # Forces the budget engine's double-entry logic to work flawlessly

    try:
        new_cat = Category(
            name=payload.name,
            type=final_type,
            icon=payload.icon,
            parent_id=payload.parent_id,
            user_id=current_user.id,
            is_active=True
        )
        session.add(new_cat)
        session.commit()
        session.refresh(new_cat)
        return new_cat
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Insert Error: {str(e)}")


@router.get("/", response_model=List[Category])
def read_categories(
    session: SessionDep,
    current_user: User = Depends(get_current_user),  # 🟢 DYNAMIC USER CONTEXT
    tree_format: bool = Query(False, description="Format response as a nested tree hierarchy")
):
    # Fetch all active categories scoped to the logged-in user
    categories = session.exec(
        select(Category)
        .where(
            Category.is_active == True,
            Category.user_id == current_user.id
        )
        .order_by(Category.id)
    ).all()

    # 🔒 CRITICAL ENGINE SAFEGUARD: Normalize type strictly in memory before rendering to UI
    for cat in categories:
        name_lower = cat.name.strip().lower()
        if "sweep" in name_lower:
            cat.type = "transfer"
        elif "credit card payment" in name_lower or "loan repayment" in name_lower:
            cat.type = "transfer"

    # Optional tree format compiler
    if tree_format:
        main_categories = [c.model_dump() for c in categories if c.parent_id is None]
        for main in main_categories:
            main["subcategories"] = [c.model_dump() for c in categories if c.parent_id == main["id"]]
        return main_categories

    return categories


@router.put("/{category_id}", response_model=Category)
def update_category(
    category_id: int,
    payload: CategoryCreateUpdate,
    session: SessionDep,
    current_user: User = Depends(get_current_user)  # 🟢 DYNAMIC USER CONTEXT
):
    db_cat = session.exec(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == current_user.id
        )
    ).first()

    if not db_cat:
        raise HTTPException(status_code=404, detail="Category not found or access denied")

    # Cyclic loop defense: Prevent infinite loop crashes in the frontend component
    if payload.parent_id == category_id:
        raise HTTPException(status_code=400, detail="A category cannot be assigned as its own parent")

    if payload.parent_id:
        parent = session.exec(
            select(Category).where(
                Category.id == payload.parent_id,
                Category.user_id == current_user.id
            )
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    # 🔒 CRITICAL ENGINE SAFEGUARD: Re-evaluate sweep parameters upon update
    final_type = payload.type
    name_lower = payload.name.strip().lower()
    if name_lower == "sweep saving" or "sweep" in name_lower:
        final_type = "transfer"

    try:
        db_cat.name = payload.name
        db_cat.type = final_type
        db_cat.icon = payload.icon
        db_cat.parent_id = payload.parent_id

        session.add(db_cat)
        session.commit()
        session.refresh(db_cat)
        return db_cat
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Update Error: {str(e)}")


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    session: SessionDep,
    current_user: User = Depends(get_current_user)  # 🟢 DYNAMIC USER CONTEXT
):
    """
    Safely soft-deletes the category for the authenticated user.
    """
    category = session.exec(
        select(Category).where(
            Category.id == category_id,
            Category.user_id == current_user.id
        )
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found or access denied")

    try:
        # Soft-delete the main requested category
        category.is_active = False
        session.add(category)

        # 🧠 Adaptive Cleanup: If this was a main umbrella category, orphan its subcategories safely
        subcategories = session.exec(
            select(Category).where(
                Category.parent_id == category_id,
                Category.user_id == current_user.id
            )
        ).all()

        for sub in subcategories:
            sub.parent_id = None
            session.add(sub)

        session.commit()
        return {"message": "Category soft-deleted successfully, dependent sub-elements cleared"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Modification Error: {str(e)}")