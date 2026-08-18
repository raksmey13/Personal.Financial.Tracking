import csv
import io
import uuid  # 🟢 ADDED for generating the link token
from fastapi import APIRouter, Response, status, HTTPException , Depends # 🟢 ADDED HTTPException
from typing import Optional
from sqlmodel import SQLModel, select, func
from database import SessionDep
from models import UserSettings, Transaction, User  # 🟢 ADDED User to models
from routes.auth import get_current_user

router = APIRouter(tags=["Settings & Analytics"])

ACTIVE_USER_ID = 1  # Standard local fallback user context


# Schema for partial updates without primary key validation errors
class UserSettingsUpdate(SQLModel):
    language: Optional[str] = None
    first_day_of_month: Optional[int] = None
    first_day_of_week: Optional[str] = None
    transition_set_transaction: Optional[bool] = None
    display_bank_check_icon: Optional[bool] = None


# =========================================================
# 1. GET & UPDATE USER SETTINGS
# =========================================================
@router.get("/settings/", response_model=UserSettings)
def get_settings(session: SessionDep):
    """Retrieves or initializes settings for the active user."""
    settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == ACTIVE_USER_ID)
    ).first()

    if not settings:
        settings = UserSettings(user_id=ACTIVE_USER_ID)
        session.add(settings)
        session.commit()
        session.refresh(settings)

    return settings


@router.patch("/settings/", response_model=UserSettings)
def update_settings(payload: UserSettingsUpdate, session: SessionDep):
    """Updates active user preferences dynamically matching UI inputs."""
    db_settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == ACTIVE_USER_ID)
    ).first()

    if not db_settings:
        db_settings = UserSettings(user_id=ACTIVE_USER_ID)

    # Only update fields provided in the request body
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_settings, key, value)

    session.add(db_settings)
    session.commit()
    session.refresh(db_settings)
    return db_settings


# =========================================================
# 2. CSV EXPORT & SUMMARY ANALYTICS
# =========================================================
@router.get("/export/csv")
def export_transactions_csv(session: SessionDep):
    """Streams filtered transaction list in raw CSV format."""
    transactions = session.exec(
        select(Transaction)
        .where(Transaction.user_id == ACTIVE_USER_ID)
        .order_by(Transaction.transaction_date.desc())
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Type", "Amount", "Description", "Category ID"])

    for tx in transactions:
        writer.writerow([
            tx.id,
            tx.transaction_date,
            tx.type,
            tx.amount,
            tx.description or "",
            tx.category_id or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_export.csv"}
    )


@router.get("/analytics/summary")
def get_summary(session: SessionDep):
    """Calculates high-level financial totals for active user context."""
    total_income = session.exec(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == ACTIVE_USER_ID,
            func.lower(Transaction.type) == "income"
        )
    ).first() or 0

    total_expense = session.exec(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == ACTIVE_USER_ID,
            func.lower(Transaction.type) == "expense"
        )
    ).first() or 0

    return {
        "total_income": float(total_income),
        "total_expense": float(total_expense),
        "net_balance": float(total_income - total_expense)
    }


@router.post("/settings/telegram/generate-link")
def generate_telegram_link(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Generates a single-use deep link token for connecting Telegram."""
    user = session.get(User, current_user.id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    link_token = str(uuid.uuid4())[:8]

    user.telegram_linking_token = link_token
    session.add(user)
    session.commit()

    bot_username = "PFTrack_Financial_bot"
    deep_link_url = f"https://t.me/{bot_username}?start={link_token}"

    return {
        "token": link_token,
        "telegram_url": deep_link_url
    }