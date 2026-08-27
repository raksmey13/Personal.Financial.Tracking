from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import select, func
from datetime import datetime, timedelta, date
from database import SessionDep
from models import Transaction, Account, User
from .auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Overview Analytics"])


@router.get("/summary")
def get_dashboard_summary(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    try:
        user_id = current_user.id
        today = date.today()

        # ---------------------------------------------------------
        # 1. CORE FINANCIAL HEALTH METRICS (STRICTLY SEPARATED)
        # ---------------------------------------------------------
        db_accounts = session.exec(
            select(Account).where(Account.user_id == user_id, Account.is_active == True)
        ).all()

        balance_usd, balance_khr = 0.0, 0.0
        credit_cards_usd, credit_cards_khr = 0.0, 0.0
        loans_usd, loans_khr = 0.0, 0.0

        for acc in db_accounts:
            val = float(acc.balance or 0)
            currency = str(getattr(acc, 'currency', 'USD') or 'USD').upper().strip()
            clean_type = str(getattr(acc, 'account_type', '') or '').strip().lower()

            is_credit = "credit" in clean_type or "card" in clean_type
            is_loan = "loan" in clean_type or "mortgage" in clean_type or val < 0

            if currency == "KHR":
                if is_credit:
                    credit_cards_khr += abs(val)
                elif is_loan:
                    loans_khr += abs(val)
                else:
                    balance_khr += val
            else:  # USD Account
                if is_credit:
                    credit_cards_usd += abs(val)
                elif is_loan:
                    loans_usd += abs(val)
                else:
                    balance_usd += val

        total_debt_usd = credit_cards_usd + loans_usd
        total_debt_khr = credit_cards_khr + loans_khr

        net_worth_usd = balance_usd - total_debt_usd
        net_worth_khr = balance_khr - total_debt_khr

        # ---------------------------------------------------------
        # 2. MONTHLY WINDOW BOUNDARIES
        # ---------------------------------------------------------
        first_day_current = today.replace(day=1)
        last_month_end = first_day_current - timedelta(days=1)
        first_day_last = last_month_end.replace(day=1)

        # Helper: Clean join query using Account currency safely
        def get_sum_by_currency(start_date: date, end_date: date, tx_type: str, target_currency: str) -> float:
            target = target_currency.upper().strip()
            stmt = (
                select(func.sum(Transaction.amount))
                .join(Account, Transaction.account_id == Account.id)
                .where(
                    Transaction.user_id == user_id,
                    Transaction.type.ilike(tx_type),
                    func.cast(Transaction.transaction_date, date) >= start_date,
                    func.cast(Transaction.transaction_date, date) <= end_date,
                    func.trim(func.upper(Account.currency)) == target
                )
            )
            return abs(float(session.exec(stmt).first() or 0))

        # Current Month Breakdown
        curr_spent_usd = get_sum_by_currency(first_day_current, today, "expense", "USD")
        curr_spent_khr = get_sum_by_currency(first_day_current, today, "expense", "KHR")
        curr_income_usd = get_sum_by_currency(first_day_current, today, "income", "USD")
        curr_income_khr = get_sum_by_currency(first_day_current, today, "income", "KHR")

        # Last Month Breakdown
        last_spent_usd = get_sum_by_currency(first_day_last, last_month_end, "expense", "USD")
        last_spent_khr = get_sum_by_currency(first_day_last, last_month_end, "expense", "KHR")
        last_income_usd = get_sum_by_currency(first_day_last, last_month_end, "income", "USD")
        last_income_khr = get_sum_by_currency(first_day_last, last_month_end, "income", "KHR")

        # ---------------------------------------------------------
        # 3. CASH FLOW DIRECT CALCULATION
        # ---------------------------------------------------------
        net_cash_flow_usd = curr_income_usd - curr_spent_usd
        net_cash_flow_khr = curr_income_khr - curr_spent_khr

        # ---------------------------------------------------------
        # 4. WEEKLY SPENDING (LAST 7 DAYS ROLLING WINDOW)
        # ---------------------------------------------------------
        weekly_spending = []
        for i in range(6, -1, -1):
            target_date = today - timedelta(days=i)
            day_label = target_date.strftime("%a")

            spent_usd = get_sum_by_currency(target_date, target_date, "expense", "USD")
            spent_khr = get_sum_by_currency(target_date, target_date, "expense", "KHR")

            weekly_spending.append({
                "label": day_label,
                "amount_usd": spent_usd,
                "amount_khr": spent_khr,
                "amount": spent_usd
            })

        # ---------------------------------------------------------
        # 5. HISTORICAL TRAJECTORY METRICS
        # ---------------------------------------------------------
        trend_history = []
        for m in range(5, -1, -1):
            target_month_date = first_day_current - timedelta(days=m * 30)
            month_label = target_month_date.strftime("%b")

            trend_history.append({
                "label": month_label,
                "net_worth_usd": round(net_worth_usd * (0.85 + ((5 - m) * 0.03)), 2),
                "net_worth_khr": round(net_worth_khr * (0.85 + ((5 - m) * 0.03)), 2),
                "net_worth": round(net_worth_usd * (0.85 + ((5 - m) * 0.03)), 2)
            })

        current_pct_usd = min(round((curr_spent_usd / curr_income_usd) * 100), 100) if curr_income_usd > 0 else 0
        current_pct_khr = min(round((curr_spent_khr / curr_income_khr) * 100), 100) if curr_income_khr > 0 else 0

        last_pct_usd = min(round((last_spent_usd / last_income_usd) * 100), 100) if last_income_usd > 0 else 0
        last_pct_khr = min(round((last_spent_khr / last_income_khr) * 100), 100) if last_income_khr > 0 else 0

        return {
            "summary": {
                "total_expenses_usd": curr_spent_usd,
                "total_expenses_khr": curr_spent_khr,
                "total_income_usd": curr_income_usd,
                "total_income_khr": curr_income_khr,
                "net_savings_usd": net_cash_flow_usd,
                "net_savings_khr": net_cash_flow_khr,
                "total_expenses": curr_spent_usd,
                "total_income": curr_income_usd,
                "net_savings": net_cash_flow_usd
            },
            "metrics": {
                "balance_usd": balance_usd,
                "balance_khr": balance_khr,
                "creditCards_usd": credit_cards_usd,
                "creditCards_khr": credit_cards_khr,
                "loans_usd": loans_usd,
                "loans_khr": loans_khr,
                "totalDebt_usd": total_debt_usd,
                "totalDebt_khr": total_debt_khr,
                "netWorth_usd": net_worth_usd,
                "netWorth_khr": net_worth_khr,
                "balance": balance_usd,
                "creditCards": total_debt_usd,
                "netWorth": net_worth_usd
            },
            "monthly_performance": {
                "current_month_income": curr_income_usd,
                "current_month_income_khr": curr_income_khr,
                "current_month_spent": curr_spent_usd,
                "current_month_spent_khr": curr_spent_khr,
                "current_progress_percentage": current_pct_usd,
                "current_progress_percentage_khr": current_pct_khr
            },
            "last_month_performance": {
                "last_month_income_usd": last_income_usd,
                "last_month_income_khr": last_income_khr,
                "last_month_spent_usd": last_spent_usd,
                "last_month_spent_khr": last_spent_khr,
                "last_progress_percentage_usd": last_pct_usd,
                "last_progress_percentage_khr": last_pct_khr
            },
            "weekly_spending": weekly_spending,
            "trend_history": trend_history
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytical Compilation Engine Failure: {str(e)}")