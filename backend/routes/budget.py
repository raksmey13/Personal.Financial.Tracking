import calendar
from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body, status, Depends
from pydantic import BaseModel
from sqlmodel import select, func, or_
from database import SessionDep
from models import (
    Budget,
    Transaction,
    Category,
    Account,
    BudgetStrategy,
    BudgetStrategyItem,
    BudgetCategoryLink,
    StrategyItemCategoryLink,
    User
)
from .auth import get_current_user
from .notification import check_and_trigger_notifications

router = APIRouter(prefix="/budgets", tags=["Budgets"])


# =========================================================
# 1. PAYLOAD SCHEMAS FOR DYNAMIC STRATEGIES
# =========================================================
class StrategyItemCreate(BaseModel):
    bucket_name: str
    percentage: float
    category_ids: List[int] = []


class StrategyUpdatePayload(BaseModel):
    name: str = "Custom Allocation Strategy"
    items: List[StrategyItemCreate]


class StandardBudgetCreate(BaseModel):
    name: Optional[str] = None
    limit_amount: float = 0.0
    currency: str = "USD"
    category_ids: List[int] = []
    is_group_budget: bool = False
    is_rollover: bool = False
    strategy_type: str = "spending_cap"


# =========================================================
# 2. DYNAMIC STRATEGY ROUTES (MACRO BUCKETS)
# =========================================================
@router.get("/strategy/")
def get_active_strategy(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """Fetches the active overarching percentage allocation strategy for the authenticated user."""
    strategy = session.exec(
        select(BudgetStrategy).where(
            BudgetStrategy.user_id == current_user.id,
            BudgetStrategy.is_active == True
        )
    ).first()

    if not strategy:
        strategy = BudgetStrategy(user_id=current_user.id, name="50/30/20 Rule", is_active=True)
        session.add(strategy)
        session.commit()
        session.refresh(strategy)

        default_items = [
            BudgetStrategyItem(strategy_id=strategy.id, bucket_name="Needs", percentage=Decimal("50.0")),
            BudgetStrategyItem(strategy_id=strategy.id, bucket_name="Wants", percentage=Decimal("30.0")),
            BudgetStrategyItem(strategy_id=strategy.id, bucket_name="Savings", percentage=Decimal("20.0")),
        ]
        session.add_all(default_items)
        session.commit()
        session.refresh(strategy)

    formatted_items = []
    for item in strategy.items:
        cat_ids = [link.category_id for link in item.category_links if link.category_id is not None]
        formatted_items.append({
            "id": item.id,
            "bucket_name": item.bucket_name,
            "percentage": float(item.percentage),
            "category_ids": cat_ids
        })

    return {
        "id": strategy.id,
        "name": strategy.name,
        "items": formatted_items
    }


@router.put("/strategy/")
def update_strategy(
    payload: StrategyUpdatePayload,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """Replaces current allocation buckets using relational StrategyItemCategoryLink junction tables."""
    try:
        total_pct = sum(Decimal(str(item.percentage)) for item in payload.items)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid percentage format provided."
        )

    if total_pct != Decimal("100.00") and round(total_pct, 2) != Decimal("100.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total percentage allocation must equal exactly 100%. Received: {total_pct}%"
        )

    strategy = session.exec(
        select(BudgetStrategy).where(
            BudgetStrategy.user_id == current_user.id,
            BudgetStrategy.is_active == True
        )
    ).first()

    if not strategy:
        strategy = BudgetStrategy(user_id=current_user.id, name=payload.name, is_active=True)
        session.add(strategy)
        session.commit()
        session.refresh(strategy)
    else:
        strategy.name = payload.name
        session.add(strategy)

    old_items = session.exec(
        select(BudgetStrategyItem).where(BudgetStrategyItem.strategy_id == strategy.id)
    ).all()
    for item in old_items:
        session.delete(item)

    session.commit()

    for item_data in payload.items:
        new_item = BudgetStrategyItem(
            strategy_id=strategy.id,
            bucket_name=item_data.bucket_name,
            percentage=Decimal(str(item_data.percentage))
        )
        session.add(new_item)
        session.commit()
        session.refresh(new_item)

        if item_data.category_ids:
            links = [
                StrategyItemCategoryLink(strategy_item_id=new_item.id, category_id=cid)
                for cid in item_data.category_ids
            ]
            session.add_all(links)

    session.commit()
    session.refresh(strategy)

    return {"status": 200, "message": "Strategy updated successfully", "strategy": strategy}


@router.delete("/strategy/")
def delete_strategy(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """Deactivates the active master allocation strategy for the current user."""
    strategy = session.exec(
        select(BudgetStrategy).where(
            BudgetStrategy.user_id == current_user.id,
            BudgetStrategy.is_active == True
        )
    ).first()

    if not strategy:
        raise HTTPException(status_code=404, detail="Active strategy not found")

    try:
        strategy.is_active = False
        session.add(strategy)
        session.commit()
        return {"message": "Master Allocation Strategy deactivated successfully"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Modification Error: {str(e)}")


# =========================================================
# 3. STANDARD CATEGORY BUDGET ROUTES
# =========================================================
@router.post("/", response_model=Budget, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: StandardBudgetCreate,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    cat_ids_list = payload.category_ids
    is_group = payload.is_group_budget
    strategy = payload.strategy_type

    if is_group and not cat_ids_list:
        raise HTTPException(status_code=400, detail="Group targets require at least one category selection.")

    try:
        primary_id = cat_ids_list[0] if cat_ids_list else None

        assigned_name = payload.name
        if not assigned_name and primary_id:
            db_cat = session.get(Category, primary_id)
            if db_cat:
                assigned_name = db_cat.name

        if not assigned_name:
            assigned_name = "Group Budget Envelope" if is_group else "Unnamed Allocation Target"

        new_budget = Budget(
            name=assigned_name,
            monthly_limit=Decimal(str(payload.limit_amount)),
            currency=payload.currency,
            is_group_budget=is_group,
            is_rollover=payload.is_rollover if strategy == "spending_cap" else False,
            strategy_type=strategy,
            user_id=current_user.id,
            is_active=True
        )

        session.add(new_budget)
        session.commit()
        session.refresh(new_budget)

        if cat_ids_list:
            links = [
                BudgetCategoryLink(budget_id=new_budget.id, category_id=cid)
                for cid in cat_ids_list
            ]
            session.add_all(links)
            session.commit()

        today = date.today()
        if primary_id:
            try:
                check_and_trigger_notifications(
                    user_id=current_user.id,
                    account_id=1,
                    category_id=primary_id,
                    session=session,
                    tx_date=today
                )
            except Exception as e:
                print(f"Budget initiation limits evaluation warning: {e}")

        return new_budget

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Insertion Error: {str(e)}")


@router.get("/calculated/")
def get_calculated_budgets(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """
    Computes real-time dynamic budget balances using a Unified Base Currency (USD base)
    with 1 USD = 4000 KHR conversion for seamless dual-currency tracking.
    """
    today = date.today()
    start_of_month = date(today.year, today.month, 1)
    _, last_day = calendar.monthrange(today.year, today.month)
    end_of_month = date(today.year, today.month, last_day)

    days_remaining = (end_of_month - today).days
    calculated_response = []

    # 🟢 Standard Exchange Rate Baseline
    KHR_RATE = 4000.0

    # 📊 1. FETCH & CALCULATE UNIFIED MASTER ALLOCATION STRATEGY
    strategy = session.exec(
        select(BudgetStrategy).where(
            BudgetStrategy.user_id == current_user.id,
            BudgetStrategy.is_active == True
        )
    ).first()

    if strategy and strategy.items:
        # Helper: Calculates total amount across both currencies normalized to USD base
        def get_unified_amount(tx_type: str, category_ids: list = None):
            # USD Transactions Query
            stmt_usd = (
                select(func.sum(func.abs(Transaction.amount)))
                .join(Account, Transaction.account_id == Account.id, isouter=True)
                .where(
                    Transaction.user_id == current_user.id,
                    func.lower(Transaction.type) == tx_type.lower(),
                    Transaction.transaction_date >= start_of_month,
                    Transaction.transaction_date <= end_of_month,
                    func.trim(func.upper(Account.currency)) == "USD"
                )
            )

            # KHR Transactions Query
            stmt_khr = (
                select(func.sum(func.abs(Transaction.amount)))
                .join(Account, Transaction.account_id == Account.id, isouter=True)
                .where(
                    Transaction.user_id == current_user.id,
                    func.lower(Transaction.type) == tx_type.lower(),
                    Transaction.transaction_date >= start_of_month,
                    Transaction.transaction_date <= end_of_month,
                    func.trim(func.upper(Account.currency)) == "KHR"
                )
            )

            if category_ids:
                stmt_usd = stmt_usd.where(Transaction.category_id.in_(category_ids))
                stmt_khr = stmt_khr.where(Transaction.category_id.in_(category_ids))

            val_usd = float(session.exec(stmt_usd).first() or 0.0)
            val_khr = float(session.exec(stmt_khr).first() or 0.0)

            # Combined equivalent in USD
            return val_usd + (val_khr / KHR_RATE)

        # Total Combined Monthly Income Pool (USD Base)
        total_income_usd = get_unified_amount("income")

        bucket_calculations = []
        for item in strategy.items:
            pct_float = float(item.percentage)
            cat_ids = [link.category_id for link in item.category_links if link.category_id is not None]

            # 🟢 Unified Cap: Shared percentage of total wealth pool
            allowed_usd = (pct_float / 100.0) * total_income_usd
            allowed_khr = allowed_usd * KHR_RATE

            # 🟢 Unified Spent: USD spent + (KHR spent / 4000)
            spent_usd = get_unified_amount("expense", cat_ids) if cat_ids else 0.0
            spent_khr = spent_usd * KHR_RATE

            bucket_calculations.append({
                "bucket_name": item.bucket_name,
                "percentage": pct_float,
                "allowed_usd": allowed_usd,
                "allowed_khr": allowed_khr,
                "spent_usd": spent_usd,
                "spent_khr": spent_khr,
                "allowed_amount": allowed_usd,
                "spent_amount": spent_usd,
                "category_ids": cat_ids
            })

        calculated_response.append({
            "id": f"strategy-{strategy.id}",
            "name": strategy.name,
            "strategy_type": "master_allocation",
            "income_pool": total_income_usd,
            "income_pool_khr": total_income_usd * KHR_RATE,
            "buckets": bucket_calculations,
            "status": "green",
            "img": f"https://api.dicebear.com/7.x/identicon/svg?seed=strategy-{strategy.id}"
        })

    # 📊 2. FETCH & CALCULATE STANDARD CATEGORY BUDGETS (Spending Caps / Fixed)
    db_budgets = session.exec(
        select(Budget).where(
            Budget.user_id == current_user.id,
            Budget.is_active == True
        )
    ).all()

    for budget in db_budgets:
        target_cat_ids = [link.category_id for link in budget.category_links if link.category_id is not None]
        target_currency = (budget.currency or "USD").upper().strip()

        limit_float = float(budget.monthly_limit or 0.0)
        alert_message = None
        status_flag = "green"

        if not target_cat_ids:
            total_spent = Decimal("0.00")
        else:
            spending_statement = (
                select(func.sum(func.abs(Transaction.amount)))
                .join(Account, Transaction.account_id == Account.id, isouter=True)
                .where(
                    Transaction.user_id == current_user.id,
                    func.lower(Transaction.type) == "expense",
                    Transaction.category_id.in_(target_cat_ids),
                    Transaction.transaction_date >= start_of_month,
                    Transaction.transaction_date <= end_of_month,
                    func.trim(func.upper(Account.currency)) == target_currency
                )
            )
            raw_sum = session.exec(spending_statement).first()
            total_spent = Decimal(str(raw_sum)) if raw_sum is not None else Decimal("0.00")

        spent_float = float(total_spent)
        residual_pocket_balance = limit_float - spent_float
        progress_percentage = round((spent_float / limit_float) * 100) if limit_float > 0 else 0

        current_strategy = budget.strategy_type or "spending_cap"

        if current_strategy == "fixed_allocation":
            if spent_float < limit_float:
                if days_remaining < 0:
                    status_flag = "red"
                    alert_message = f"🚨 Overdue! Your commitment for '{budget.name}' was due {abs(days_remaining)} days ago."
                elif days_remaining == 0:
                    status_flag = "red"
                    alert_message = f"⏰ Due Today! Don't forget to clear your {budget.currency} ${limit_float:.2f} {budget.name} allocation."
                elif days_remaining <= 5:
                    status_flag = "amber"
                    alert_message = f"⚠️ Reminder: You only have {days_remaining} days left until your {budget.name} payment deadline!"
            else:
                status_flag = "green"
                alert_message = f"✅ Settled: Fixed commitment allocation for {budget.name} fully cleared."
        else:
            if progress_percentage >= 100:
                status_flag = "red"
                alert_message = f"🚨 Alert: You have completely blown past your maximum budget for {budget.name} by {budget.currency} ${abs(residual_pocket_balance):.2f}!"
            elif progress_percentage >= 80:
                status_flag = "amber"
                alert_message = f"⚠️ Careful: You have consumed {progress_percentage}% of your spending limit for {budget.name}."

        calculated_response.append({
            "id": budget.id,
            "name": budget.name or "Category Budget",
            "currency": budget.currency,
            "start": start_of_month.strftime("%m/%d/%Y"),
            "end": end_of_month.strftime("%m/%d/%Y"),
            "spent": spent_float,
            "current": spent_float,
            "total": limit_float,
            "progress": progress_percentage,
            "residual": residual_pocket_balance,
            "status": status_flag,
            "days_left": days_remaining,
            "alert_message": alert_message,
            "strategy_type": current_strategy,
            "is_group_budget": budget.is_group_budget or False,
            "is_rollover": budget.is_rollover or False,
            "category_ids": target_cat_ids,
            "img": f"https://api.dicebear.com/7.x/identicon/svg?seed={budget.id}"
        })

    return calculated_response


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """Deactivates a budget threshold rule for the authenticated user (Soft Delete)."""
    budget = session.exec(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.user_id == current_user.id
        )
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    try:
        budget.is_active = False
        session.add(budget)
        session.commit()
        return {"message": "Budget rule deactivated successfully"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Modification Error: {str(e)}")