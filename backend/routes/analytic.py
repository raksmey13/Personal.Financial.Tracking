from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select, func
from sqlalchemy.orm import aliased
from datetime import date, timedelta
from typing import Optional
from decimal import Decimal
from database import SessionDep
from models import Transaction, Account, Category, Budget

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics Engine"])


@router.get("/report")
def get_custom_analytics_report(
        session: SessionDep,
        tab: str = Query(..., description="category | time | future"),
        view_type: str = Query("expenses", alias="view_type", description="expenses | income | both"),  # 🚀 FIXED: Parameter map alias
        from_date: date = Query(...),
        to_date: date = Query(...),
        account_target: str = Query("all", alias="account_target"),  # 🚀 FIXED: Parameter map alias
        include_debts: bool = Query(False),
        depth: str = Query("main", description="main | sub"),
        credit_card_rule: str = Query("payment"),
        forecast_unit: str = Query("month", alias="forecast_unit")  # 🚀 FIXED: Parameter map alias
):
    try:
        # Convert string context filter safely
        account_id = int(account_target) if (account_target and account_target != "all" and account_target.isdigit()) else None

        # ----------------------------------------------------------------─
        # 🟢 ENGINE TASK 1: RETRIEVE ALL MATCHING RAW TRANSACTIONS + RELATIONSHIPS
        # ----------------------------------------------------------------─
        tx_statement = select(
            Transaction.id,
            Transaction.amount,
            Transaction.type,
            Transaction.description,
            Transaction.transaction_date,
            Transaction.category_id,
            Account.account_name,
            Category.name.label("cat_name"),
            Category.icon.label("cat_icon"),
            Category.parent_id.label("cat_parent_id")
        ).join(Account, Transaction.account_id == Account.id) \
            .join(Category, Transaction.category_id == Category.id)

        # Apply strict date-window bounds and skip account baseline setup rows
        tx_statement = tx_statement.where(
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
            Transaction.description != "Opening Balance Baseline"
        )

        if account_id:
            tx_statement = tx_statement.where(Transaction.account_id == account_id)

        if view_type == "expenses":
            tx_statement = tx_statement.where(Transaction.type.ilike("expense"))
        elif view_type == "income":
            tx_statement = tx_statement.where(Transaction.type.ilike("income"))

        # Enforces debt exclusion filter logic natively if checkbox is unticked
        if not include_debts:
            tx_statement = tx_statement.where(Account.account_type != "Credit Card")
            tx_statement = tx_statement.where(Account.account_type != "Loan")

        raw_results = session.exec(tx_statement).all()

        transactions_payload = []
        for tx_id, tx_amount, tx_type, tx_desc, tx_date, tx_cat_id, acc_name, cat_name, cat_icon, cat_parent_id in raw_results:
            transactions_payload.append({
                "id": tx_id,
                "amount": float(tx_amount),
                "type": tx_type,
                "description": tx_desc if (tx_desc and tx_desc.strip()) else cat_name,
                "transaction_date": tx_date.strftime("%Y-%m-%d") if tx_date else "",
                "account_name": acc_name,
                "category_id": tx_cat_id,
                "category": {
                    "id": tx_cat_id,
                    "name": cat_name,
                    "icon": cat_icon,
                    "parent_id": cat_parent_id
                }
            })

        # ----------------------------------------------------------------─
        # 🟢 ENGINE TASK 2: LIVE CATEGORY GROUP-BY AGGREGATIONS
        # ----------------------------------------------------------------─
        ParentCategory = aliased(Category)

        if depth == "main":
            category_label = func.coalesce(ParentCategory.name, Category.name)
            category_statement = select(
                category_label.label("display_name"),
                func.sum(Transaction.amount).label("total_amount")
            ).select_from(Category) \
                .join(Transaction, Transaction.category_id == Category.id) \
                .join(Account, Transaction.account_id == Account.id) \
                .join(ParentCategory, Category.parent_id == ParentCategory.id, isouter=True) \
                .group_by(category_label)
        else:
            category_label = func.coalesce(ParentCategory.name + " ➔ " + Category.name, Category.name)
            category_statement = select(
                category_label.label("display_name"),
                func.sum(Transaction.amount).label("total_amount")
            ).select_from(Category) \
                .join(Transaction, Transaction.category_id == Category.id) \
                .join(Account, Transaction.account_id == Account.id) \
                .join(ParentCategory, Category.parent_id == ParentCategory.id, isouter=True) \
                .group_by(category_label)

        category_statement = category_statement.where(
            Category.id == Transaction.category_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
            Transaction.description != "Opening Balance Baseline"
        )

        if account_id:
            category_statement = category_statement.where(Transaction.account_id == account_id)
        if view_type == "expenses":
            category_statement = category_statement.where(Transaction.type.ilike("expense"))
        elif view_type == "income":
            category_statement = category_statement.where(Transaction.type.ilike("income"))

        # Enforces debt exclusion filter logic for chart groups too
        if not include_debts:
            category_statement = category_statement.where(Account.account_type != "Credit Card")
            category_statement = category_statement.where(Account.account_type != "Loan")

        aggregated_categories = session.exec(category_statement).all()

        categories_payload = []
        for index, (display_name, total_sum) in enumerate(aggregated_categories):
            categories_payload.append({
                "name": display_name,
                "amount": float(total_sum or 0),
                "color": f"hsl({(index * 65) % 360}, 65%, 55%)"
            })

        # ----------------------------------------------------------------─
        # 🟢 ENGINE TASK 3: LIVE HISTORICAL TIME-SERIES & CASH FLOW
        # ----------------------------------------------------------------─
        time_series_payload = []
        cash_flow_payload = []

        time_stmt = select(Transaction.transaction_date, Transaction.type, Transaction.amount) \
            .join(Account, Transaction.account_id == Account.id) \
            .where(Transaction.transaction_date >= from_date, Transaction.transaction_date <= to_date)

        if account_id:
            time_stmt = time_stmt.where(Transaction.account_id == account_id)

        if not include_debts:
            time_stmt = time_stmt.where(Account.account_type != "Credit Card")
            time_stmt = time_stmt.where(Account.account_type != "Loan")

        time_results = session.exec(time_stmt).all()

        daily_deltas = {}
        curr_day = from_date
        while curr_day <= to_date:
            daily_deltas[curr_day.strftime("%Y-%m-%d")] = Decimal(0)
            curr_day += timedelta(days=1)

        for tx_date, tx_type, tx_amount in time_results:
            d_str = tx_date.strftime("%Y-%m-%d")
            if d_str in daily_deltas:
                if tx_type.lower().startswith("expense"):
                    daily_deltas[d_str] -= tx_amount
                else:
                    daily_deltas[d_str] += tx_amount

        base_balance_stmt = select(func.sum(Account.balance))
        if account_id:
            base_balance_stmt = select(Account.balance).where(Account.id == account_id)
        current_running_total = float(session.exec(base_balance_stmt).first() or 0)

        for day_str in sorted(daily_deltas.keys()):
            net_change = float(daily_deltas[day_str])
            time_series_payload.append({"date": day_str, "amount": net_change})

            current_running_total += net_change
            cash_flow_payload.append({"date": day_str, "balance": current_running_total})

        # ----------------------------------------------------------------─
        # 🟢 ENGINE TASK 4: FORECASTING & PLAN BUDGET-BASED RUNWAY FORECAST
        # ----------------------------------------------------------------─
        future_projections_payload = []

        income_stmt = select(func.sum(Transaction.amount)) \
            .join(Account, Transaction.account_id == Account.id) \
            .where(
            Transaction.type.ilike("income"),
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
            Transaction.description != "Opening Balance Baseline"
        )
        if account_id:
            income_stmt = income_stmt.where(Transaction.account_id == account_id)

        if not include_debts:
            income_stmt = income_stmt.where(Account.account_type != "Credit Card")
            income_stmt = income_stmt.where(Account.account_type != "Loan")

        total_income_raw = float(session.exec(income_stmt).first() or 0.0)

        days_in_window = max((to_date - from_date).days, 1)
        months_in_window = max(days_in_window / 30.0, 1.0)
        avg_monthly_income = total_income_raw / months_in_window

        active_budgets_stmt = select(Budget.monthly_limit)
        budget_results = session.exec(active_budgets_stmt).all()

        total_monthly_budget_expense = sum(float(limit or 0.0) for limit in budget_results)

        if total_monthly_budget_expense == 0:
            total_monthly_budget_expense = 500.0

        if forecast_unit.lower() == "month":
            net_rate_per_unit = avg_monthly_income - total_monthly_budget_expense
            unit_label_prefix = "Month"
        else:
            net_rate_per_unit = (avg_monthly_income - total_monthly_budget_expense) / 30.0
            unit_label_prefix = "Day"

        projection_steps = 6
        running_predictive_liquidity = current_running_total

        for step in range(1, projection_steps + 1):
            label = f"{unit_label_prefix} +{step}"
            running_predictive_liquidity += net_rate_per_unit

            future_projections_payload.append({
                "period": label,
                "expected_change": round(net_rate_per_unit, 2),
                "projected_total": round(max(running_predictive_liquidity, 0.0), 2)
            })

        return {
            "categories": categories_payload,
            "transactions": transactions_payload,
            "time_series": time_series_payload,
            "cash_flow": cash_flow_payload,
            "future_projections": future_projections_payload
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Reporting Aggregation Fault: {str(e)}")