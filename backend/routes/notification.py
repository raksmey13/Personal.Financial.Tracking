from datetime import datetime, date, timedelta
from typing import List, Optional
from decimal import Decimal
from calendar import monthrange
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, delete, func

# Import centralized definitions from models.py
from models import (
    Notification, Account, Transaction, Budget, Category, User,
    BudgetCategoryLink, BudgetStrategy, BudgetStrategyItem, PendingTransaction
)
from database import SessionDep
from .auth import get_current_user

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


@router.get("/", response_model=List[Notification])
def get_user_notifications(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """
    Fetches all notification logs for the authenticated user, ordered by newest first.
    Dynamically evaluates milestones, debt due windows, grace periods, pending items, and liquidity states on load.
    """
    user_id = current_user.id
    today = date.today()
    current_day = today.day
    days_in_month = monthrange(today.year, today.month)[1]

    start_of_month = date(today.year, today.month, 1)
    end_of_month = date(today.year, today.month, days_in_month)

    created_in_session = set()

    # =========================================================================
    # 0. AUTO-CLEANUP EXPIRED NOTIFICATIONS
    # =========================================================================
    try:
        cleanup_stmt = delete(Notification).where(
            Notification.user_id == user_id,
            Notification.expires_at < datetime.utcnow()
        )
        session.exec(cleanup_stmt)
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Notification cleanup error: {e}")

    # Fetch active user accounts once for evaluation
    try:
        all_user_accounts = session.exec(
            select(Account).where(Account.user_id == user_id, Account.is_active == True)
        ).all()
    except Exception:
        all_user_accounts = []

    # =========================================================================
    # 1. MILESTONE EVALUATOR: GLOBAL NET WORTH & DEBT CLEARANCE
    # =========================================================================
    try:
        debt_accounts = [a for a in all_user_accounts if a.account_type.lower() in ["credit card", "loan"]]
        total_liabilities = sum(abs(float(a.balance)) for a in debt_accounts)

        total_usd_assets = sum(float(a.balance) for a in all_user_accounts if
                               a.currency.upper() == "USD" and a.account_type.lower() in ["normal", "savings"])
        net_worth_usd = total_usd_assets - total_liabilities

        # A. INDIVIDUAL LOAN PAYOFF MILESTONES
        for d_acc in debt_accounts:
            if abs(float(d_acc.balance)) == 0.0:
                dedup_key_paid = f"loan_paid_{d_acc.id}_{today.strftime('%Y_%m')}"
                if dedup_key_paid not in created_in_session:
                    existing_paid = session.exec(
                        select(Notification).where(
                            Notification.user_id == user_id,
                            Notification.deduplication_key == dedup_key_paid
                        )
                    ).first()

                    if not existing_paid:
                        session.add(Notification(
                            user_id=user_id,
                            title="🎉 Loan Fully Paid Off!",
                            message=f"Congratulations! Your '{d_acc.account_name}' balance is officially $0.00!",
                            notification_type="success",
                            is_read=False,
                            created_at=datetime.utcnow(),
                            entity_type="account",
                            entity_id=d_acc.id,
                            deduplication_key=dedup_key_paid,
                            expires_at=datetime.utcnow() + timedelta(days=30)
                        ))
                        created_in_session.add(dedup_key_paid)

        # B. GLOBAL DEBT FREE MILESTONE
        if total_liabilities == 0.0 and len(debt_accounts) > 0:
            dedup_key_milestone = f"debt_cleared_milestone_{today.strftime('%Y_%m')}"
            if dedup_key_milestone not in created_in_session:
                existing_milestone = session.exec(
                    select(Notification).where(
                        Notification.user_id == user_id,
                        Notification.deduplication_key == dedup_key_milestone
                    )
                ).first()

                if not existing_milestone:
                    session.add(Notification(
                        user_id=user_id,
                        title="🏆 All Liabilities Cleared!",
                        message=f"You are officially 100% debt free! Your USD Net Worth is now ${net_worth_usd:.2f}.",
                        notification_type="success",
                        is_read=False,
                        created_at=datetime.utcnow(),
                        deduplication_key=dedup_key_milestone,
                        expires_at=datetime.utcnow() + timedelta(days=30)
                    ))
                    created_in_session.add(dedup_key_milestone)
    except Exception as e:
        print(f"Milestone evaluation error: {e}")

    # =========================================================================
    # 2. ACCOUNT DUE DATES, GRACE PERIODS & LIQUIDITY
    # =========================================================================
    acc_stmt = select(Account).where(
        Account.user_id == user_id,
        Account.payment_due_day.isnot(None),
        Account.is_active == True
    )

    try:
        accounts_with_dues = session.exec(acc_stmt).all()

        for acc in accounts_with_dues:
            if abs(float(acc.balance)) == 0.0:
                continue

            due_day = int(acc.payment_due_day)
            days_until_due = due_day - current_day

            if days_until_due < -15:
                days_until_due += days_in_month

            target_month = today.month if due_day >= current_day else (today.month % 12) + 1
            target_year = today.year if target_month >= today.month else today.year + 1
            period_label = date(target_year, target_month, 1).strftime("%B %Y")

            # A. Grace Period / Overdue Warning (-3 to -1 days past due)
            if -3 <= days_until_due < 0:
                title = "🚨 Overdue Payment Warning!"
                msg = f"Your '{acc.account_name}' payment was due on the {due_day}th. Clear it immediately to avoid real-world interest penalties."
                dedup_key = f"payment_overdue_{acc.id}_{target_year}_{target_month:02d}"

                if dedup_key not in created_in_session:
                    if not session.exec(select(Notification).where(Notification.user_id == user_id,
                                                                   Notification.deduplication_key == dedup_key)).first():
                        session.add(Notification(
                            user_id=user_id, title=title, message=msg, notification_type="danger",
                            is_read=False, created_at=datetime.utcnow(), entity_type="account", entity_id=acc.id,
                            deduplication_key=dedup_key, expires_at=datetime.utcnow() + timedelta(days=7)
                        ))
                        created_in_session.add(dedup_key)

            # B. Standard Upcoming Window (0 to 7 days) + Cross-Currency Liquidity Check
            elif 0 <= days_until_due <= 7:
                title = f"Payment Reminder ({period_label})"

                liquidity_warning = ""
                if acc.currency.upper() == "USD":
                    usd_assets_total = sum(float(a.balance) for a in all_user_accounts if
                                           a.currency.upper() == "USD" and a.account_type in ["Normal", "Savings"])
                    khr_assets_total = sum(float(a.balance) for a in all_user_accounts if
                                           a.currency.upper() == "KHR" and a.account_type in ["Normal", "Savings"])

                    if usd_assets_total < 3000.0 and khr_assets_total > 1000000:
                        liquidity_warning = " We noticed your USD balance is low while your KHR reserves are high—consider a cross-currency conversion transfer."

                if days_until_due == 0:
                    msg = f"🚨 Due Today: Your '{acc.account_name}' payment is due today!{liquidity_warning}"
                else:
                    msg = f"📅 Upcoming Due: Your '{acc.account_name}' payment is due in {days_until_due} days (on the {due_day}th).{liquidity_warning}"

                dedup_key = f"payment_due_{acc.id}_{target_year}_{target_month:02d}"
                if dedup_key not in created_in_session:
                    if not session.exec(select(Notification).where(Notification.user_id == user_id,
                                                                   Notification.deduplication_key == dedup_key)).first():
                        session.add(Notification(
                            user_id=user_id, title=title, message=msg, notification_type="warning",
                            is_read=False, created_at=datetime.utcnow(), entity_type="account", entity_id=acc.id,
                            deduplication_key=dedup_key, expires_at=datetime.utcnow() + timedelta(days=14)
                        ))
                        created_in_session.add(dedup_key)
    except Exception as e:
        print(f"Account check error: {e}")

    # =========================================================================
    # 3. EVALUATE FIXED ALLOCATION BUDGET COMMITMENTS & BURN RATES
    # =========================================================================
    budget_stmt = select(Budget).where(
        Budget.user_id == user_id,
        Budget.is_active == True
    )

    try:
        active_budgets_list = session.exec(budget_stmt).all()
        days_until_month_end = days_in_month - current_day
        month_progress_ratio = Decimal(str(current_day / days_in_month))

        for budget in active_budgets_list:
            target_cat_ids = [link.category_id for link in budget.category_links if link.category_id is not None]
            b_curr = (budget.currency or "USD").upper().strip()

            spent_this_month = Decimal("0.00")
            if target_cat_ids:
                tx_stmt = (
                    select(func.sum(func.abs(Transaction.amount)))
                    .join(Account, Transaction.account_id == Account.id, isouter=True)
                    .where(
                        Transaction.user_id == user_id,
                        Transaction.category_id.in_(target_cat_ids),
                        func.lower(Transaction.type) == "expense",
                        Transaction.transaction_date >= start_of_month,
                        Transaction.transaction_date <= end_of_month,
                        func.trim(func.upper(Account.currency)) == b_curr
                    )
                )
                result = session.exec(tx_stmt).first()
                spent_this_month = Decimal(str(result)) if result else Decimal("0.00")

            # A. Fixed Allocation Due Reminders
            if budget.strategy_type == "fixed_allocation" and days_until_month_end <= 31:
                if spent_this_month < budget.monthly_limit:
                    period_label = today.strftime("%B %Y")
                    symbol = "៛" if b_curr == "KHR" else "$"
                    if days_until_month_end == 0:
                        title = f"Final Day: {budget.name}"
                        msg = f"🚨 Due Today! Don't forget to clear your {b_curr} {symbol}{budget.monthly_limit:,.2f} commitment for '{budget.name}'."
                    else:
                        title = f"Commitment Reminder: {budget.name}"
                        msg = f"⚠️ Reminder: You have {days_until_month_end} days left in {period_label} to clear your '{budget.name}' allocation."

                    dedup_key = f"budget_due_warning_{budget.id}_{today.strftime('%Y_%m')}"
                    if dedup_key not in created_in_session:
                        if not session.exec(select(Notification).where(Notification.user_id == user_id,
                                                                       Notification.deduplication_key == dedup_key)).first():
                            session.add(Notification(
                                user_id=user_id, title=title, message=msg, notification_type="warning",
                                is_read=False, created_at=datetime.utcnow(), entity_type="budget", entity_id=budget.id,
                                deduplication_key=dedup_key, expires_at=datetime.utcnow() + timedelta(days=14)
                            ))
                            created_in_session.add(dedup_key)

            # B. Smart Burn Rate Pace Alert (For Spending Caps)
            elif budget.strategy_type != "fixed_allocation" and budget.monthly_limit > 0:
                spend_ratio = spent_this_month / budget.monthly_limit
                if spend_ratio > (month_progress_ratio + Decimal("0.20")) and spend_ratio < Decimal("1.0"):
                    dedup_key = f"burn_rate_{budget.id}_{today.strftime('%Y_%m')}"
                    if dedup_key not in created_in_session:
                        if not session.exec(select(Notification).where(Notification.user_id == user_id,
                                                                       Notification.deduplication_key == dedup_key)).first():
                            session.add(Notification(
                                user_id=user_id,
                                title=f"Fast Burn Rate: {budget.name}",
                                message=f"Pacing Alert: You have used {float(spend_ratio) * 100:.0f}% of your budget with {days_until_month_end} days remaining in the month.",
                                notification_type="warning",
                                is_read=False,
                                created_at=datetime.utcnow(),
                                entity_type="budget",
                                entity_id=budget.id,
                                deduplication_key=dedup_key,
                                expires_at=datetime.utcnow() + timedelta(days=7)
                            ))
                            created_in_session.add(dedup_key)
    except Exception as e:
        print(f"Budget & burn rate check error: {e}")

    # =========================================================================
    # 4. EVALUATE PENDING UNCATEGORIZED TRANSACTIONS
    # =========================================================================
    try:
        pending_items = session.exec(
            select(PendingTransaction).where(
                PendingTransaction.user_id == user_id,
                PendingTransaction.status == "pending"
            )
        ).all()

        for p_item in pending_items:
            dedup_key_pending = f"pending_staged_{p_item.id}"
            if dedup_key_pending not in created_in_session:
                existing_p_notif = session.exec(
                    select(Notification).where(
                        Notification.user_id == user_id,
                        Notification.deduplication_key == dedup_key_pending
                    )
                ).first()

                if not existing_p_notif:
                    session.add(Notification(
                        user_id=user_id,
                        title="📥 Action Required: Uncategorized Transaction",
                        message=f"New transaction of ${p_item.amount:.2f} from '{p_item.raw_beneficiary_name}' needs a category. Please assign it in your Pending Inbox.",
                        notification_type="warning",
                        is_read=False,
                        created_at=datetime.utcnow(),
                        entity_type="transaction",
                        entity_id=p_item.id,
                        deduplication_key=dedup_key_pending,
                        expires_at=datetime.utcnow() + timedelta(days=14)
                    ))
                    created_in_session.add(dedup_key_pending)
    except Exception as e:
        print(f"Pending items evaluation error: {e}")

    try:
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Dynamic notification evaluation error: {e}")

    # =========================================================================
    # 5. RETURN FULL SYNCHRONIZED LOG
    # =========================================================================
    statement = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    return session.exec(statement).all()


@router.put("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: int,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """
    Marks a specific notification alert as read for the authenticated user.
    """
    notification = session.exec(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification record not found or access denied")

    notification.is_read = True
    session.add(notification)
    session.commit()
    return {"message": "Notification marked as read successfully"}


# =========================================================================
# LIVE NOTIFICATION ENGINE PROCESSOR (For Mutation Events)
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
    Evaluates business rule violations and budget overspends right after transaction mutations.
    """
    KHR_RATE = Decimal("4000.0")

    # --- RULE 1: AUTO-SWEEP SUCCESS LOGICAL EVENT ---
    if sweep_triggered and sweep_amount > Decimal("0.00"):
        session.add(Notification(
            user_id=user_id,
            title="Sweep System Success",
            message=f"Automated 50/30/20 allocation triggered. Diverted ${sweep_amount:.2f} of incoming revenue safely into your active Savings Target.",
            notification_type="success",
            is_read=False,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=7)
        ))

    # --- RULE 2: ACCOUNT LOW BALANCE ASSERTER ---
    account = session.get(Account, account_id)
    if account and account.user_id == user_id and not account.is_savings_target:
        acc_curr = str(account.currency or "USD").upper().strip()
        low_threshold = Decimal("400000.00") if acc_curr == "KHR" else Decimal("100.00")
        symbol = "៛" if acc_curr == "KHR" else "$"

        if account.balance < low_threshold:
            dedup_key = f"low_balance_{account.id}_{date.today()}"
            existing = session.exec(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.deduplication_key == dedup_key
                )
            ).first()

            if not existing:
                session.add(Notification(
                    user_id=user_id,
                    title="Low Balance Alert",
                    message=f"Liquidity warning! Your account '{account.account_name}' has dipped to {acc_curr} {symbol}{account.balance:,.2f}.",
                    notification_type="warning",
                    is_read=False,
                    created_at=datetime.utcnow(),
                    entity_type="account",
                    entity_id=account.id,
                    deduplication_key=dedup_key,
                    expires_at=datetime.utcnow() + timedelta(days=7)
                ))

    # --- RULE 3: CATEGORY BUDGET CAP, FIXED COMMITMENT & MASTER ALLOCATION DETECTOR ---
    tx_month_start = date(tx_date.year, tx_date.month, 1)
    _, tx_last_day = monthrange(tx_date.year, tx_date.month)
    tx_month_end = date(tx_date.year, tx_date.month, tx_last_day)
    period_str = tx_month_start.strftime('%Y_%m')
    period_label = tx_month_start.strftime("%B %Y")

    acc_currency = str(account.currency or "USD").upper().strip() if account else "USD"

    base_stmt = select(Budget).where(Budget.user_id == user_id, Budget.is_active == True)
    all_active_budgets = session.exec(base_stmt).all()

    for budget in all_active_budgets:
        target_cat_ids = [link.category_id for link in budget.category_links if link.category_id is not None]
        if category_id not in target_cat_ids:
            continue

        b_curr = (budget.currency or "USD").upper().strip()
        if b_curr != acc_currency:
            continue

        tx_stmt = (
            select(func.sum(func.abs(Transaction.amount)))
            .join(Account, Transaction.account_id == Account.id, isouter=True)
            .where(
                Transaction.user_id == user_id,
                Transaction.category_id.in_(target_cat_ids),
                func.lower(Transaction.type) == "expense",
                Transaction.transaction_date >= tx_month_start,
                Transaction.transaction_date <= tx_month_end,
                func.trim(func.upper(Account.currency)) == b_curr
            )
        )
        raw_spent = session.exec(tx_stmt).first()
        total_spent = Decimal(str(raw_spent)) if raw_spent is not None else Decimal("0.00")
        symbol = "៛" if b_curr == "KHR" else "$"

        # A. FIXED ALLOCATION / CREDIT SETTLEMENT TRIGGER
        if budget.strategy_type == "fixed_allocation":
            utilization_ratio = total_spent / budget.monthly_limit if budget.monthly_limit > 0 else Decimal("0")

            if utilization_ratio >= Decimal("1.0"):
                dedup_key_settled = f"fixed_settled_{budget.id}_{period_str}"
                if not session.exec(select(Notification).where(Notification.user_id == user_id, Notification.deduplication_key == dedup_key_settled)).first():
                    session.add(Notification(
                        user_id=user_id,
                        title=f"✅ Commitment Cleared ({period_label})",
                        message=f"Fixed commitment settled for '{budget.name}'. Fully cleared {b_curr} {symbol}{total_spent:,.2f}/{budget.monthly_limit:,.2f}.",
                        notification_type="success",
                        is_read=False,
                        created_at=datetime.utcnow(),
                        entity_type="budget",
                        entity_id=budget.id,
                        deduplication_key=dedup_key_settled,
                        expires_at=datetime.utcnow() + timedelta(days=14)
                    ))
            elif utilization_ratio >= Decimal("0.80"):  # 🟢 Warn at 80% for Fixed Commitments
                dedup_key_near = f"fixed_near_{budget.id}_{period_str}"
                if not session.exec(select(Notification).where(Notification.user_id == user_id, Notification.deduplication_key == dedup_key_near)).first():
                    session.add(Notification(
                        user_id=user_id,
                        title=f"⚠️ Near Commitment Target ({period_label})",
                        message=f"You have used {float(utilization_ratio) * 100:.1f}% of your commitment for '{budget.name}' ({b_curr} {symbol}{total_spent:,.2f}/{budget.monthly_limit:,.2f}).",
                        notification_type="warning",
                        is_read=False,
                        created_at=datetime.utcnow(),
                        entity_type="budget",
                        entity_id=budget.id,
                        deduplication_key=dedup_key_near,
                        expires_at=datetime.utcnow() + timedelta(days=14)
                    ))

        # B. SPENDING CAP LIMIT ALERTS
        elif budget.monthly_limit > 0:
            utilization_ratio = total_spent / budget.monthly_limit
            dedup_key_breach = f"budget_breach_1.0_{budget.id}_{period_str}"
            dedup_key_warn = f"budget_warn_0.85_{budget.id}_{period_str}"

            if utilization_ratio >= Decimal("1.0"):
                if not session.exec(select(Notification).where(Notification.user_id == user_id, Notification.deduplication_key == dedup_key_breach)).first():
                    session.add(Notification(
                        user_id=user_id,
                        title=f"🚨 Budget Limit Exceeded ({period_label})",
                        message=f"Hard spending cap exceeded on '{budget.name}'. Current spent: {b_curr} {symbol}{total_spent:,.2f}/{budget.monthly_limit:,.2f}.",
                        notification_type="danger",
                        is_read=False,
                        created_at=datetime.utcnow(),
                        entity_type="budget",
                        entity_id=budget.id,
                        deduplication_key=dedup_key_breach,
                        expires_at=datetime.utcnow() + timedelta(days=30)
                    ))
            elif utilization_ratio >= Decimal("0.85"):
                if not session.exec(select(Notification).where(Notification.user_id == user_id, Notification.deduplication_key == dedup_key_warn)).first():
                    session.add(Notification(
                        user_id=user_id,
                        title=f"⚠️ Budget Cap Warning ({period_label})",
                        message=f"Approaching limit. You have used {float(utilization_ratio) * 100:.1f}% of your ceiling for '{budget.name}' ({b_curr} {symbol}{total_spent:,.2f}/{budget.monthly_limit:,.2f}).",
                        notification_type="warning",
                        is_read=False,
                        created_at=datetime.utcnow(),
                        entity_type="budget",
                        entity_id=budget.id,
                        deduplication_key=dedup_key_warn,
                        expires_at=datetime.utcnow() + timedelta(days=30)
                    ))

    # --- RULE 4: UNIFIED MASTER STRATEGY (50/30/20) BUCKET EVALUATOR ---
    strategy = session.exec(
        select(BudgetStrategy).where(
            BudgetStrategy.user_id == user_id,
            BudgetStrategy.is_active == True
        )
    ).first()

    if strategy and strategy.items:
        # 1. Total Unified Income Pool (USD Base)
        inc_usd_stmt = select(func.sum(func.abs(Transaction.amount))).join(Account, Transaction.account_id == Account.id).where(
            Transaction.user_id == user_id, func.lower(Transaction.type) == "income",
            Transaction.transaction_date >= tx_month_start, Transaction.transaction_date <= tx_month_end,
            func.trim(func.upper(Account.currency)) == "USD"
        )
        inc_khr_stmt = select(func.sum(func.abs(Transaction.amount))).join(Account, Transaction.account_id == Account.id).where(
            Transaction.user_id == user_id, func.lower(Transaction.type) == "income",
            Transaction.transaction_date >= tx_month_start, Transaction.transaction_date <= tx_month_end,
            func.trim(func.upper(Account.currency)) == "KHR"
        )

        usd_inc = Decimal(str(session.exec(inc_usd_stmt).first() or "0.00"))
        khr_inc = Decimal(str(session.exec(inc_khr_stmt).first() or "0.00"))
        total_income_usd = usd_inc + (khr_inc / KHR_RATE)

        # 2. Check Buckets linked to this category
        for item in strategy.items:
            b_cat_ids = [link.category_id for link in item.category_links if link.category_id is not None]
            if category_id not in b_cat_ids:
                continue

            pct_float = Decimal(str(item.percentage or 0.0))
            allowed_usd_cap = (pct_float / Decimal("100.0")) * total_income_usd

            # Unified Bucket Expenses
            exp_usd_stmt = select(func.sum(func.abs(Transaction.amount))).join(Account, Transaction.account_id == Account.id).where(
                Transaction.user_id == user_id, Transaction.category_id.in_(b_cat_ids),
                func.lower(Transaction.type) == "expense", Transaction.transaction_date >= tx_month_start,
                Transaction.transaction_date <= tx_month_end, func.trim(func.upper(Account.currency)) == "USD"
            )
            exp_khr_stmt = select(func.sum(func.abs(Transaction.amount))).join(Account, Transaction.account_id == Account.id).where(
                Transaction.user_id == user_id, Transaction.category_id.in_(b_cat_ids),
                func.lower(Transaction.type) == "expense", Transaction.transaction_date >= tx_month_start,
                Transaction.transaction_date <= tx_month_end, func.trim(func.upper(Account.currency)) == "KHR"
            )

            usd_exp = Decimal(str(session.exec(exp_usd_stmt).first() or "0.00"))
            khr_exp = Decimal(str(session.exec(exp_khr_stmt).first() or "0.00"))
            total_spent_usd = usd_exp + (khr_exp / KHR_RATE)

            if allowed_usd_cap > Decimal("0.00"):
                bucket_ratio = total_spent_usd / allowed_usd_cap
                dedup_strat_breach = f"strat_breach_1.0_{item.id}_{period_str}"
                dedup_strat_warn = f"strat_warn_0.85_{item.id}_{period_str}"

                if bucket_ratio >= Decimal("1.0"):
                    if not session.exec(select(Notification).where(Notification.user_id == user_id, Notification.deduplication_key == dedup_strat_breach)).first():
                        session.add(Notification(
                            user_id=user_id,
                            title=f"🚨 Strategy Bucket Breach: {item.bucket_name}",
                            message=f"Over allocation! Your '{item.bucket_name}' ({pct_float}%) bucket cap of ${allowed_usd_cap:,.2f} USD has been exceeded!",
                            notification_type="danger",
                            is_read=False,
                            created_at=datetime.utcnow(),
                            deduplication_key=dedup_strat_breach,
                            expires_at=datetime.utcnow() + timedelta(days=30)
                        ))
                elif bucket_ratio >= Decimal("0.85"):
                    if not session.exec(select(Notification).where(Notification.user_id == user_id, Notification.deduplication_key == dedup_strat_warn)).first():
                        session.add(Notification(
                            user_id=user_id,
                            title=f"⚠️ Strategy Bucket Warning: {item.bucket_name}",
                            message=f"Pacing Alert: You have used {float(bucket_ratio) * 100:.1f}% of your '{item.bucket_name}' ({pct_float}%) bucket allowance.",
                            notification_type="warning",
                            is_read=False,
                            created_at=datetime.utcnow(),
                            deduplication_key=dedup_strat_warn,
                            expires_at=datetime.utcnow() + timedelta(days=30)
                        ))

    try:
        session.flush()
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Notification engine error: {e}")