from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends
from sqlmodel import select, func
from sqlalchemy.orm import aliased
from database import SessionDep
from models import Transaction, Account, Category, Budget, BudgetStrategy, BudgetStrategyItem, User
from .auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics Engine"])


@router.get("/report")
def get_custom_analytics_report(
        session: SessionDep,
        current_user: User = Depends(get_current_user),
        tab: str = Query(..., description="category | time | future"),
        view_type: str = Query("expenses", alias="view_type", description="expenses | income | both"),
        from_date: date = Query(...),
        to_date: date = Query(...),
        account_target: str = Query("all", alias="account_target"),
        currency_target: str = Query("all", alias="currency_target", description="all | USD | KHR"),
        include_debts: bool = Query(False),
        depth: str = Query("main", description="main | sub"),
        forecast_unit: str = Query("month", alias="forecast_unit"),
        steps: Optional[int] = Query(None, description="Number of future periods to predict")
):
    try:
        user_id = current_user.id
        account_id = int(account_target) if (
                    account_target and account_target != "all" and account_target.isdigit()) else None
        target_currency = currency_target.strip().upper() if currency_target and currency_target != "all" else None

        if steps is None:
            steps = 7 if forecast_unit.lower().startswith("day") else 6

        # =========================================================
        # 1. RAW TRANSACTIONS LIST PAYLOAD (PRESERVING NATIVE CURRENCY)
        # =========================================================
        tx_statement = select(
            Transaction.id,
            Transaction.amount,
            Transaction.type,
            Transaction.description,
            Transaction.transaction_date,
            Transaction.category_id,
            Account.account_name,
            Account.currency.label("acc_currency"),
            Category.name.label("cat_name"),
            Category.icon.label("cat_icon"),
            Category.parent_id.label("cat_parent_id")
        ).join(Account, Transaction.account_id == Account.id) \
            .join(Category, Transaction.category_id == Category.id, isouter=True)

        tx_statement = tx_statement.where(
            Account.user_id == user_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
            Transaction.description != "Opening Balance Baseline"
        )

        if account_id:
            tx_statement = tx_statement.where(Transaction.account_id == account_id)

        if target_currency:
            tx_statement = tx_statement.where(func.trim(func.upper(Account.currency)) == target_currency)

        # 🟢 FIX: Handle both 'expenses'/'expense' and 'income' safely
        v_type_clean = view_type.strip().lower()
        if v_type_clean.startswith("expense"):
            tx_statement = tx_statement.where(func.lower(Transaction.type).like("expense%"))
        elif v_type_clean.startswith("income"):
            tx_statement = tx_statement.where(func.lower(Transaction.type).like("income%"))

        if not include_debts:
            tx_statement = tx_statement.where(Account.account_type != "Credit Card")
            tx_statement = tx_statement.where(Account.account_type != "Loan")

        raw_results = session.exec(tx_statement).all()

        transactions_payload = []
        for tx_id, tx_amount, tx_type, tx_desc, tx_date, tx_cat_id, acc_name, acc_currency, cat_name, cat_icon, cat_parent_id in raw_results:
            raw_val = float(tx_amount or 0.0)
            curr = str(acc_currency or "USD").strip().upper()
            display_cat = cat_name or "Uncategorized"

            transactions_payload.append({
                "id": tx_id,
                "amount": abs(raw_val),
                "currency": curr,
                "type": tx_type,
                "description": tx_desc if (tx_desc and tx_desc.strip()) else display_cat,
                "transaction_date": tx_date.strftime("%Y-%m-%d") if tx_date else "",
                "account_name": acc_name,
                "category_id": tx_cat_id,
                "category": {
                    "id": tx_cat_id,
                    "name": display_cat,
                    "icon": cat_icon or "",
                    "parent_id": cat_parent_id
                }
            })

        # =========================================================
        # 2. CATEGORY BREAKDOWN AGGREGATION (CURRENCY SEPARATED)
        # =========================================================
        ParentCategory = aliased(Category)

        if depth == "main":
            category_label = func.coalesce(ParentCategory.name, Category.name)
        else:
            category_label = func.coalesce(
                func.concat(ParentCategory.name, " ➔ ", Category.name),
                Category.name
            )

        category_statement = select(
            category_label.label("display_name"),
            func.trim(func.upper(Account.currency)).label("currency"),
            func.sum(func.abs(Transaction.amount)).label("total_amount")
        ).select_from(Category) \
            .join(Transaction, Transaction.category_id == Category.id) \
            .join(Account, Transaction.account_id == Account.id) \
            .join(ParentCategory, Category.parent_id == ParentCategory.id, isouter=True) \
            .group_by(category_label, func.trim(func.upper(Account.currency)))

        category_statement = category_statement.where(
            Account.user_id == user_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date,
            Transaction.description != "Opening Balance Baseline"
        )

        if account_id:
            category_statement = category_statement.where(Transaction.account_id == account_id)

        if target_currency:
            category_statement = category_statement.where(func.trim(func.upper(Account.currency)) == target_currency)

        # 🟢 FIX: Flexible case-insensitive type filtering for aggregated categories
        if v_type_clean.startswith("expense"):
            category_statement = category_statement.where(func.lower(Transaction.type).like("expense%"))
        elif v_type_clean.startswith("income"):
            category_statement = category_statement.where(func.lower(Transaction.type).like("income%"))

        if not include_debts:
            category_statement = category_statement.where(Account.account_type != "Credit Card")
            category_statement = category_statement.where(Account.account_type != "Loan")

        aggregated_categories = session.exec(category_statement).all()

        categories_usd = []
        categories_khr = []
        for index, (display_name, curr, total_sum) in enumerate(aggregated_categories):
            item = {
                "name": display_name or "Uncategorized",
                "amount": abs(float(total_sum or 0)),
                "currency": curr,
                "color": f"hsl({(index * 65) % 360}, 65%, 55%)"
            }
            if curr == "KHR":
                categories_khr.append(item)
            else:
                categories_usd.append(item)

        # =========================================================
        # 3. TIME-SERIES & CASH-FLOW DATA (SEPARATE DUAL CURRENCY TRACKS)
        # =========================================================
        time_series_usd, time_series_khr = [], []
        cash_flow_usd, cash_flow_khr = [], []

        # Step A: Get Current Live Balances
        acc_stmt = select(Account).where(Account.user_id == user_id, Account.is_active == True)
        if not include_debts:
            acc_stmt = acc_stmt.where(Account.account_type != "Credit Card", Account.account_type != "Loan")
        if account_id:
            acc_stmt = acc_stmt.where(Account.id == account_id)

        user_accounts = session.exec(acc_stmt).all()
        bal_usd = sum(float(a.balance or 0.0) for a in user_accounts if str(a.currency).strip().upper() == "USD")
        bal_khr = sum(float(a.balance or 0.0) for a in user_accounts if str(a.currency).strip().upper() == "KHR")

        # Step B: Reverse engineer the true starting balance just before 'from_date'
        future_tx_stmt = select(Transaction.type, Transaction.amount, Account.currency) \
            .join(Account, Transaction.account_id == Account.id) \
            .where(
            Account.user_id == user_id,
            Transaction.transaction_date >= from_date
        )

        if account_id:
            future_tx_stmt = future_tx_stmt.where(Transaction.account_id == account_id)
        if target_currency:
            future_tx_stmt = future_tx_stmt.where(func.trim(func.upper(Account.currency)) == target_currency)
        if not include_debts:
            future_tx_stmt = future_tx_stmt.where(Account.account_type != "Credit Card")
            future_tx_stmt = future_tx_stmt.where(Account.account_type != "Loan")

        start_bal_usd, start_bal_khr = bal_usd, bal_khr
        for tx_type, tx_amount, acc_currency in session.exec(future_tx_stmt).all():
            raw = float(tx_amount or 0.0)
            is_deduction = str(tx_type).lower().startswith("expense") or raw < 0
            signed_val = -abs(raw) if is_deduction else abs(raw)

            curr = str(acc_currency or "USD").strip().upper()
            if curr == "KHR":
                start_bal_khr -= signed_val  # Step backward in time
            else:
                start_bal_usd -= signed_val

        # Step C: Gather transactions within the date range for the charts
        time_stmt = select(Transaction.transaction_date, Transaction.type, Transaction.amount, Account.currency,
                           Transaction.description) \
            .join(Account, Transaction.account_id == Account.id) \
            .where(
            Account.user_id == user_id,
            Transaction.transaction_date >= from_date,
            Transaction.transaction_date <= to_date
        )

        if account_id:
            time_stmt = time_stmt.where(Transaction.account_id == account_id)
        if target_currency:
            time_stmt = time_stmt.where(func.trim(func.upper(Account.currency)) == target_currency)
        if not include_debts:
            time_stmt = time_stmt.where(Account.account_type != "Credit Card")
            time_stmt = time_stmt.where(Account.account_type != "Loan")

        daily_bar_usd, daily_bar_khr = {}, {}
        daily_line_usd, daily_line_khr = {}, {}

        curr_day = from_date
        while curr_day <= to_date:
            d_key = curr_day.strftime("%Y-%m-%d")
            daily_bar_usd[d_key] = 0.0
            daily_bar_khr[d_key] = 0.0
            daily_line_usd[d_key] = 0.0
            daily_line_khr[d_key] = 0.0
            curr_day += timedelta(days=1)

        for tx_date, tx_type, tx_amount, acc_currency, tx_desc in session.exec(time_stmt).all():
            d_str = tx_date.strftime("%Y-%m-%d")
            raw = float(tx_amount or 0.0)
            is_deduction = str(tx_type).lower().startswith("expense") or raw < 0
            signed_val = -abs(raw) if is_deduction else abs(raw)
            is_baseline = (tx_desc == "Opening Balance Baseline")

            curr = str(acc_currency or "USD").strip().upper()
            if d_str in daily_line_usd:
                if curr == "KHR":
                    daily_line_khr[d_str] += signed_val
                    if not is_baseline:
                        daily_bar_khr[d_str] += signed_val
                else:
                    daily_line_usd[d_str] += signed_val
                    if not is_baseline:
                        daily_bar_usd[d_str] += signed_val

        # Step D: Map aggregated data into the arrays
        running_usd, running_khr = start_bal_usd, start_bal_khr
        for day_str in sorted(daily_line_usd.keys()):
            # Bar chart uses the filtered delta (No baselines, accurately signed)
            time_series_usd.append({"date": day_str, "amount": round(daily_bar_usd[day_str], 2)})
            time_series_khr.append({"date": day_str, "amount": round(daily_bar_khr[day_str], 2)})

            # Line chart adds the true financial delta to match reality exactly
            running_usd += daily_line_usd[day_str]
            running_khr += daily_line_khr[day_str]

            cash_flow_usd.append({"date": day_str, "balance": round(running_usd, 2)})
            cash_flow_khr.append({"date": day_str, "balance": round(running_khr, 2)})

        # =========================================================
        # 4. FUTURE FORECAST ENGINE (SEPARATED BY CURRENCY)
        # =========================================================
        def calc_currency_future(curr_code: str, starting_balance: float):
            inc_stmt = select(func.sum(func.abs(Transaction.amount))).join(Account,
                                                                           Transaction.account_id == Account.id).where(
                Account.user_id == user_id,
                func.lower(Transaction.type).like("income%"),
                Transaction.transaction_date >= from_date,
                Transaction.transaction_date <= to_date,
                func.trim(func.upper(Account.currency)) == curr_code,
                Transaction.description != "Opening Balance Baseline"
            )
            exp_stmt = select(func.sum(func.abs(Transaction.amount))).join(Account,
                                                                           Transaction.account_id == Account.id).where(
                Account.user_id == user_id,
                func.lower(Transaction.type).like("expense%"),
                Transaction.transaction_date >= from_date,
                Transaction.transaction_date <= to_date,
                func.trim(func.upper(Account.currency)) == curr_code,
                Transaction.description != "Opening Balance Baseline"
            )

            if account_id:
                inc_stmt = inc_stmt.where(Transaction.account_id == account_id)
                exp_stmt = exp_stmt.where(Transaction.account_id == account_id)

            if not include_debts:
                inc_stmt = inc_stmt.where(Account.account_type != "Credit Card", Account.account_type != "Loan")
                exp_stmt = exp_stmt.where(Account.account_type != "Credit Card", Account.account_type != "Loan")

            total_inc = float(session.exec(inc_stmt).first() or 0.0)
            total_exp = float(session.exec(exp_stmt).first() or 0.0)

            days_w = max((to_date - from_date).days, 1)
            months_w = max(days_w / 30.0, 1.0)

            if forecast_unit.lower().startswith("day"):
                rate = (total_inc - total_exp) / float(days_w)
                prefix = "Day"
            else:
                avg_inc = total_inc / months_w
                avg_exp = total_exp / months_w
                rate = avg_inc - avg_exp
                prefix = "Month"

            projections = []
            r_bal = starting_balance
            for s in range(1, steps + 1):
                r_bal += rate
                projections.append({
                    "period": f"{prefix} +{s}",
                    "expected_change": round(rate, 2),
                    "projected_total": round(max(r_bal, 0.0), 2)
                })
            return projections

        future_usd = calc_currency_future("USD", bal_usd)
        future_khr = calc_currency_future("KHR", bal_khr)

        return {
            "transactions": transactions_payload,
            "categories": {
                "usd": categories_usd,
                "khr": categories_khr,
                "all": categories_usd + categories_khr
            },
            "time_series": {
                "usd": time_series_usd,
                "khr": time_series_khr
            },
            "cash_flow": {
                "usd": cash_flow_usd,
                "khr": cash_flow_khr
            },
            "future_projections": {
                "usd": future_usd,
                "khr": future_khr
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Reporting Aggregation Fault: {str(e)}")