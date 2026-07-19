from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select
from datetime import date, timedelta
from typing import Optional, List, Dict, Any
from database import SessionDep
from models import Budget, Account, Transaction, Category  # 🚀 Added Transaction and Category

router = APIRouter(prefix="/calendar", tags=["Calendar Engine"])


@router.get("/events")
def get_calendar_events(
        session: SessionDep,
        year: int = Query(..., description="e.g. 2026"),
        month: int = Query(..., description="1-12")
):
    try:
        events_payload: Dict[str, List[Dict[str, Any]]] = {}

        # Define month range boundaries
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)

        # ─── 📅 1. FETCH BUDGET & BILL DEADLINES ───
        budgets_stmt = select(Budget).where(
            Budget.end_date >= start_date,
            Budget.end_date <= end_date
        )
        db_budgets = session.exec(budgets_stmt).all()

        for b in db_budgets:
            date_str = b.end_date.strftime("%Y-%m-%d")
            if date_str not in events_payload:
                events_payload[date_str] = []

            events_payload[date_str].append({
                "id": f"budget-{b.id}",
                "title": b.name or "Unnamed Target",
                "amount": float(b.monthly_limit),
                "strategy_type": b.strategy_type,
                "type": "fixed_bill" if b.strategy_type == "fixed_allocation" else "spending_cap",
                "color": "amber" if b.strategy_type == "fixed_allocation" else "red"
            })

        # ─── 💳 2. FETCH CREDIT CARD / LOAN DUE DAYS ───
        accounts_stmt = select(Account).where(Account.payment_due_day != None)
        db_accounts = session.exec(accounts_stmt).all()

        for acc in db_accounts:
            try:
                due_date = date(year, month, acc.payment_due_day)
                date_str = due_date.strftime("%Y-%m-%d")

                if date_str not in events_payload:
                    events_payload[date_str] = []

                events_payload[date_str].append({
                    "id": f"account-{acc.id}",
                    "title": f"Pay {acc.account_name} Statement",
                    "amount": float(acc.balance),
                    "strategy_type": "credit_card_payment",
                    "type": "statement_due",
                    "color": "blue"
                })
            except ValueError:
                continue

        # ─── 🛍️ 3. NEW: FETCH HISTORICAL DAILY TRANSACTIONS ───
        tx_stmt = select(Transaction).where(
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
            Transaction.description != "Opening Balance Baseline"  # 🚀 Filter out baselines just like Overview!
        )
        db_transactions = session.exec(tx_stmt).all()

        # Gather categories map to show the category name on the event bar block
        categories_map = {c.id: c.name for c in session.exec(select(Category)).all()}

        for tx in db_transactions:
            date_str = tx.transaction_date.strftime("%Y-%m-%d")
            if date_str not in events_payload:
                events_payload[date_str] = []

            is_expense = tx.type.lower() == "expense"
            cat_name = categories_map.get(tx.category_id, "Transaction")

            events_payload[date_str].append({
                "id": f"tx-{tx.id}",
                # e.g., "Food: -$15.00" or "Salary: +$500.00"
                "title": f"{cat_name}: {'-' if is_expense else '+'}${float(tx.amount):.2f}",
                "amount": float(tx.amount),
                "strategy_type": "historical_ledger",
                "type": "transaction",
                "color": "purple"  # 🚀 Given a custom unique color token for transaction item identification
            })

        return events_payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar event assembly failure: {str(e)}")