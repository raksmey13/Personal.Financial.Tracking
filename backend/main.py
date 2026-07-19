from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles  # 🟢 1. IMPORT STATICFILES UTILITY
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from datetime import date

from database import create_db_and_tables, engine
from models import Category, User

# 🚀 REGISTER ALL MODULARIZED APP ROUTES CLEANLY
from routes import (
    transactions_router,
    accounts_router,
    categories_router,
    budget_router,
    analytics_router,
    overview_router,
    calender_router,
    auth_router,
    notification_router,
    # Matches your routes/__init__.py naming perfectly now
)


def init_system_defaults():
    """
    Automates baseline environment initialization:
    1. Seeds testing User 1 to prevent Foreign Key dependency constraint violations.
    2. Seeds the core system and liability transfer categories with correct icons.
    """
    with Session(engine) as session:
        # ─── STEP 1: SEED DEFAULT TESTING USER ───
        existing_user = session.exec(select(User).where(User.id == 1)).first()
        if not existing_user:
            try:
                mock_user = User(
                    id=1,
                    email="smey@example.com",
                    hashed_password="mock_password_hash_123",
                    is_active=True,
                    is_admin=False,
                    created_at=date.today()
                )
                session.add(mock_user)
                session.commit()
                print("🏁 Success: Base Testing User 1 seeded cleanly.")
            except Exception as e:
                session.rollback()
                print(f"⚠️ Warning during user seed: {str(e)}")

        # ─── STEP 2: SEED CRITICAL CATEGORIES ───
        default_categories = [
            {"name": "Opening Balance", "type": "income", "icon": "wallet"},
            {"name": "Credit Card Payment", "type": "transfer", "icon": "credit-card"},
            {"name": "Loan Repayment", "type": "transfer", "icon": "bank"},
            {"name": "Loan Principal Top-Up", "type": "expense", "icon": "trending-up"},
            # 🎯 DEDICATED MANUAL SAVINGS CATEGORY
            {"name": "Sweep Saving", "type": "income", "icon": "piggy-bank"}
        ]

        for item in default_categories:
            statement = select(Category).where(
                Category.name == item["name"],
                Category.type == item["type"]
            )
            existing_cat = session.exec(statement).first()

            if not existing_cat:
                new_category = Category(
                    name=item["name"],
                    type=item["type"],
                    icon=item["icon"],
                    is_active=True,
                    parent_id=None
                )
                session.add(new_category)

        session.commit()
        print("🏁 Success: System infrastructure categories verified.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create your database schema tables safely
    create_db_and_tables()
    # 2. Seed both user context and category systems instantly
    init_system_defaults()
    yield


# Initialize the application instance using our optimized clean lifespan configuration
app = FastAPI(lifespan=lifespan, title="Personal Finance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🟢 2. MOUNT THE STATIC DIR: Exposes the local "static" directory onto the network web address path
app.mount("/static", StaticFiles(directory="static"), name="static")

# 🚀 REGISTER ALL MODULARIZED APP ROUTES
app.include_router(transactions_router)
app.include_router(accounts_router)
app.include_router(categories_router)
app.include_router(budget_router)
app.include_router(overview_router)
app.include_router(analytics_router)
app.include_router(auth_router)
app.include_router(notification_router)

# 🚀 FIXED: Explicitly register the calendar module under the analytics path prefix here
app.include_router(calender_router, prefix="/analytics")


@app.get("/")
def read_root():
    return {"message": "Welcome to your Finance API. Routes have been modularized successfully."}