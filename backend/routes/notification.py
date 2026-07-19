from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

# Import centralized definitions from models.py
from models import Notification, Account, Transaction, Budget, Category
from database import SessionDep

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)

@router.get("/", response_model=List[Notification])
def get_user_notifications(session: SessionDep, user_id: int = 1):
    """
    Fetches all notification logs for a specific user, ordered by newest first.
    """
    statement = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
    return session.exec(statement).all()

@router.put("/{notification_id}/read")
def mark_notification_as_read(notification_id: int, session: SessionDep):
    """
    Marks a specific notification alert as read.
    """
    notification = session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification record not found")
    notification.is_read = True
    session.add(notification)
    session.commit()
    return {"message": "Notification marked as read successfully"}


# =========================================================================
# LIVE NOTIFICATION ENGINE PROCESSOR
# =========================================================================

def check_and_trigger_notifications(
        user_id: int,
        account_id: int,
        category_id: int,
        session: Session,
        tx_date: date,
        sweep_triggered: bool = False,
        sweep_amount: Decimal = Decimal("0.00")
):
    """
    Evaluates business rule violations right after mutations.
    To be called from transaction.py or budget.py inside database contexts.
    """
    # --- RULE 1: AUTO-SWEEP SUCCESS LOGICAL EVENT ---
    if sweep_triggered and sweep_amount > Decimal("0.00"):
        session.add(Notification(
            user_id=user_id,
            title="Sweep System Success",
            message=f"Automated 50/30/20 allocation triggered. Diverted ${sweep_amount:.2f} of incoming revenue safely into your active Savings Target.",
            notification_type="success",
            is_read=False,
            created_at=datetime.utcnow()
        ))

    # --- RULE 2: ACCOUNT LOW BALANCE EXCLUSION ASSERTER ---
    account = session.get(Account, account_id)
    if account and account.user_id == user_id and account.balance < Decimal("100.00") and not account.is_savings_target:
        existing = session.exec(
            select(Notification)
            .where(Notification.user_id == user_id)
            .where(Notification.notification_type == "warning")
            .where(Notification.title == "Low Balance Alert")
        ).all()

        if not any(notif.created_at.date() == date.today() for notif in existing):
            session.add(Notification(
                user_id=user_id,
                title="Low Balance Alert",
                message=f"Liquidity warning! Your account '{account.account_name}' has dipped to ${account.balance:.2f}.",
                notification_type="warning",
                is_read=False,
                created_at=datetime.utcnow()
            ))

    # --- RULE 3: CATEGORY BUDGET CAP AND OVERSPEND DETECTOR ---
    # Fetch active budgets running within the context of the transaction date
    base_stmt = (
        select(Budget)
        .where(Budget.user_id == user_id)
        .where(Budget.start_date <= tx_date)
        .where(Budget.end_date >= tx_date)
    )
    all_timeframe_budgets = session.exec(base_stmt).all()

    # Match against regular budget keys or group budgets saved as a CSV array
    active_budgets = []
    for budget in all_timeframe_budgets:
        if budget.category_id == category_id:
            active_budgets.append(budget)
        elif budget.category_ids_csv:
            csv_ids = [x.strip() for x in budget.category_ids_csv.split(",") if x.strip().isdigit()]
            if str(category_id) in csv_ids:
                active_budgets.append(budget)

    for budget in active_budgets:
        target_cat_ids = []
        if budget.category_ids_csv:
            target_cat_ids = [int(x.strip()) for x in budget.category_ids_csv.split(",") if x.strip().isdigit()]
        elif budget.category_id:
            target_cat_ids = [budget.category_id]

        if not target_cat_ids:
            continue

        # Sum total expenses inside this budget envelope
        tx_stmt = (
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .where(Transaction.category_id.in_(target_cat_ids))
            .where(Transaction.type == "expense")
            .where(Transaction.transaction_date >= budget.start_date)
            .where(Transaction.transaction_date <= budget.end_date)
        )
        transactions = session.exec(tx_stmt).all()
        total_spent = sum(tx.amount for tx in transactions)

        if budget.monthly_limit > 0:
            utilization_ratio = total_spent / budget.monthly_limit

            # Hard Cap Breach Evaluation (>= 100%)
            if utilization_ratio >= Decimal("1.0"):
                session.add(Notification(
                    user_id=user_id,
                    title="Budget Limit Breach",
                    message=f"Hard spending cap exceeded on category envelope '{budget.name}'. Current volume: ${total_spent:.2f}/${budget.monthly_limit:.2f}.",
                    notification_type="warning",
                    is_read=False,
                    created_at=datetime.utcnow()
                ))
            # 85% Warning Limit Evaluation (>= 85%)
            elif utilization_ratio >= Decimal("0.85"):
                session.add(Notification(
                    user_id=user_id,
                    title="Budget Cap Warning",
                    message=f"Approaching ceiling limit. You have used {float(utilization_ratio) * 100:.1f}% of your category limits for '{budget.name}' (${total_spent:.2f}/${budget.monthly_limit:.2f}).",
                    notification_type="warning",
                    is_read=False,
                    created_at=datetime.utcnow()
                ))

    # 🟢 FORCE IMMEDIATE FLUSH TO PERSIST THE RECORDS
    try:
        session.flush()  # Forces records out of memory state down into the tables
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Notification engine error: {e}")