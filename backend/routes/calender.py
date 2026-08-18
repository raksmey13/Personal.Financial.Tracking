from fastapi import APIRouter, HTTPException, Query, Depends
from sqlmodel import select
from datetime import date, datetime, timedelta
import calendar
from typing import List, Dict, Any
from database import SessionDep
from models import Budget, Account, Transaction, Category, User
from .auth import get_current_user  # 🟢 RELATIVE IMPORT MATCHING YOUR FOLDER STRUCTURE

router = APIRouter(prefix="/calendar", tags=["Calendar Engine"])


@router.get("/events")
def get_calendar_events(
        session: SessionDep,
        current_user: User = Depends(get_current_user),  # 🟢 DYNAMIC USER CONTEXT
        year: int = Query(..., description="e.g. 2026"),
        month: int = Query(..., description="1-12")
):
    try:
        user_id = current_user.id
        events_payload: Dict[str, List[Dict[str, Any]]] = {}

        # 1. Define month range boundaries
        start_date = date(year, month, 1)
        _, last_day = calendar.monthrange(year, month)
        end_date = date(year, month, last_day)

        # ─── 📅 1. FETCH BUDGET & BILL DEADLINES (USER SCOPED) ───
        budgets_stmt = select(Budget).where(
            Budget.user_id == user_id,
            Budget.is_active == True
        )
        db_budgets = session.exec(budgets_stmt).all()

        for b in db_budgets:
            budget_date = getattr(b, "end_date", None) or getattr(b, "start_date", None) or getattr(b, "created_at", None)

            # Standardize datetime objects to date
            if isinstance(budget_date, datetime):
                budget_date = budget_date.date()

            # If valid date exists, check if it falls in the target month
            if isinstance(budget_date, date):
                if not (start_date <= budget_date <= end_date):
                    continue
                date_str = budget_date.strftime("%Y-%m-%d")
            else:
                date_str = start_date.strftime("%Y-%m-%d")

            if date_str not in events_payload:
                events_payload[date_str] = []

            strat_type = getattr(b, "strategy_type", "fixed_allocation")
            events_payload[date_str].append({
                "id": f"budget-{b.id}",
                "title": getattr(b, "name", None) or "Budget Target",
                "amount": float(getattr(b, "monthly_limit", 0) or 0),
                "strategy_type": strat_type,
                "type": "fixed_bill" if strat_type == "fixed_allocation" else "spending_cap",
                "color": "amber" if strat_type == "fixed_allocation" else "red"
            })

        # ─── 💳 2. FETCH CREDIT CARD / LOAN DUE DAYS (USER SCOPED) ───
        accounts_stmt = select(Account).where(
            Account.user_id == user_id,
            Account.is_active == True,
            Account.payment_due_day != None
        )
        db_accounts = session.exec(accounts_stmt).all()

        for acc in db_accounts:
            if not acc.payment_due_day:
                continue

            # Clamp payment_due_day to valid month range
            actual_due_day = min(int(acc.payment_due_day), last_day)

            try:
                due_date = date(year, month, actual_due_day)
                date_str = due_date.strftime("%Y-%m-%d")

                if date_str not in events_payload:
                    events_payload[date_str] = []

                events_payload[date_str].append({
                    "id": f"account-{acc.id}",
                    "title": f"Pay {acc.account_name} Statement",
                    "amount": float(acc.balance or 0),
                    "strategy_type": "credit_card_payment",
                    "type": "statement_due",
                    "color": "blue"
                })
            except Exception:
                continue

        # ─── 🛍️ 3. FETCH HISTORICAL DAILY TRANSACTIONS (USER SCOPED) ───
        tx_stmt = select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.description != "Opening Balance Baseline"
        )
        db_transactions = session.exec(tx_stmt).all()

        categories_map = {c.id: c.name for c in session.exec(select(Category).where(Category.user_id == user_id)).all()}

        for tx in db_transactions:
            if not tx.transaction_date:
                continue

            tx_date = tx.transaction_date
            if isinstance(tx_date, datetime):
                tx_date = tx_date.date()

            date_str = tx_date.strftime("%Y-%m-%d")
            if date_str not in events_payload:
                events_payload[date_str] = []

            tx_type = (tx.type or "expense").lower()
            is_expense = tx_type == "expense"
            cat_name = categories_map.get(tx.category_id, "Transaction")
            tx_amount = float(tx.amount or 0)

            events_payload[date_str].append({
                "id": f"tx-{tx.id}",
                "title": f"{cat_name}: {'-' if is_expense else '+'}${tx_amount:.2f}",
                "amount": tx_amount,
                "strategy_type": "historical_ledger",
                "type": "transaction",
                "color": "purple"
            })

        return events_payload

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Calendar event assembly failure: {str(e)}"
        )