from fastapi import APIRouter, HTTPException, Body, status
from datetime import date
from decimal import Decimal
from sqlmodel import select, func
from database import SessionDep
from models import Budget, Transaction, Category

# 🟢 IMPORT THE NOTIFICATION ENGINE FOR CAPACITY CHECKING
from .notification import check_and_trigger_notifications

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.post("/", response_model=Budget, status_code=status.HTTP_201_CREATED)
def create_budget(payload: dict = Body(...), session: SessionDep = None):
    """
    Creates a new budget line entry, converting multi-category arrays into a highly indexable csv string.
    Supports customized percentage allocations and automatically triggers a savings transfer sweep.
    """
    cat_ids_list = payload.get("category_ids", [])
    is_group = payload.get("is_group_budget", False)
    strategy = payload.get("strategy_type", "spending_cap")

    if (is_group or strategy == "50_30_20") and not cat_ids_list:
        raise HTTPException(
            status_code=400,
            detail="Structural configuration error: Strategy targets require at least one category selection choice."
        )

    try:
        csv_string = ",".join([str(cid) for cid in cat_ids_list]) if cat_ids_list else None
        primary_id = int(cat_ids_list[0]) if cat_ids_list else None

        assigned_name = payload.get("name")
        if not assigned_name and primary_id:
            db_cat = session.get(Category, primary_id)
            if db_cat:
                assigned_name = db_cat.name

        if not assigned_name:
            if strategy == "50_30_20":
                assigned_name = "Pro Allocation Master Strategy"
            else:
                assigned_name = "Group Budget Envelope" if is_group else "Unnamed Allocation Target"

        needs_p = int(payload.get("needs_percentage", 50))
        wants_p = int(payload.get("wants_percentage", 30))
        savings_p = int(payload.get("savings_percentage", 20))

        start_dt = date.fromisoformat(payload.get("start_date"))
        end_dt = date.fromisoformat(payload.get("end_date"))
        active_user_id = payload.get("user_id", 1)

        new_budget = Budget(
            name=assigned_name,
            monthly_limit=Decimal(str(payload.get("limit_amount", 0.0))),
            category_ids_csv=csv_string,
            category_id=primary_id,
            is_group_budget=True if strategy == "50_30_20" else is_group,
            is_rollover=payload.get("is_rollover", False) if strategy == "spending_cap" else False,
            start_date=start_dt,
            end_date=end_dt,
            strategy_type=strategy,
            user_id=active_user_id,
            needs_percentage=needs_p,
            wants_percentage=wants_p,
            savings_percentage=savings_p
        )

        session.add(new_budget)
        session.commit()
        session.refresh(new_budget)

        # 🟢 THE SYSTEM AUTOMATION SWEEP TRIGGER (Double-Entry Strategy Pattern)
        if strategy == "50_30_20":
            # 1. Fetch any income transactions that already exist within this timeframe
            income_statement = select(Transaction).where(
                Transaction.user_id == active_user_id,
                func.lower(Transaction.type) == "income",
                Transaction.transaction_date >= start_dt,
                Transaction.transaction_date <= end_dt
            )
            historical_incomes = session.exec(income_statement).all()

            # 2. Look up the targeted Savings Account structure row to hold the balance jump
            from models import Account

            # Grab the unique ACTIVE designated target account
            savings_account = session.exec(
                select(Account).where(
                    Account.user_id == active_user_id,
                    Account.is_active == True,
                    Account.is_savings_target == True
                )
            ).first()

            # Fallback block to guard stability if flag isn't explicitly set yet
            if not savings_account:
                savings_account = session.exec(
                    select(Account).where(
                        Account.user_id == active_user_id,
                        Account.is_active == True,
                        func.lower(Account.account_type).contains("save")
                    )
                ).first()

            if savings_account and historical_incomes:
                for income_tx in historical_incomes:
                    # Compute the percentage sweep slice
                    sweep_amount = float(income_tx.amount) * (savings_p / 100.0)

                    if sweep_amount > 0:
                        # 💸 Row A: The Outflow leaving the source checking account
                        outflow_transfer = Transaction(
                            user_id=active_user_id,
                            amount=Decimal(str(sweep_amount)),
                            type="transfer",
                            account_id=income_tx.account_id,  # Linked to Checking Source
                            category_id=primary_id,
                            transaction_date=date.today(),
                            description=f"🤖 Auto Sweep Outflow ({income_tx.description})"
                        )

                        # 🐷 Row B: The Inflow landing inside your savings ledger vault
                        inflow_transfer = Transaction(
                            user_id=active_user_id,
                            amount=Decimal(str(sweep_amount)),
                            type="transfer",
                            account_id=savings_account.id,  # Linked directly to pristine active account ID
                            category_id=primary_id,
                            transaction_date=date.today(),
                            description=f"🤖 Auto Sweep Inflow ({income_tx.description})"
                        )

                        session.add(outflow_transfer)
                        session.add(inflow_transfer)

                        # Synchronize memory values before flushing context targets
                        savings_account.balance += Decimal(str(sweep_amount))

                        # Find checking source account to balance books seamlessly
                        source_account = session.get(Account, income_tx.account_id)
                        if source_account:
                            source_account.balance -= Decimal(str(sweep_amount))
                            session.add(source_account)

                        # Trigger context sweep success notification for historical entry processing
                        try:
                            check_and_trigger_notifications(
                                user_id=active_user_id,
                                account_id=income_tx.account_id,
                                category_id=primary_id,
                                session=session,
                                tx_date=date.today(),
                                sweep_triggered=True,
                                sweep_amount=Decimal(str(sweep_amount))
                            )
                        except Exception as notif_err:
                            print(f"Historical sweep notification warning: {notif_err}")

                session.add(savings_account)
                # Bulk save all generated balanced rows safely
                session.commit()

        # 🟢 EVALUATE BUDGET ALERTS UPON NEW SPECIFICATION (Historical limits verification)
        if primary_id:
            try:
                check_and_trigger_notifications(
                    user_id=active_user_id,
                    account_id=1,  # Fallback dummy check structural account ID
                    category_id=primary_id,
                    session=session,
                    tx_date=start_dt  # Evaluates historical metrics using new budget timeline window
                )
            except Exception as e:
                print(f"Budget initiation limits evaluation warning: {e}")

        return new_budget

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Insertion Error: {str(e)}")


@router.get("/calculated/")
def get_calculated_budgets(session: SessionDep):
    """
    Computes real-time dynamic budget tracking balances and custom calendar vs spending alert streams.
    """
    db_budgets = session.exec(select(Budget)).all()
    calculated_response = []
    today = date.today()
    active_user_id = 1

    for budget in db_budgets:
        target_cat_ids = []

        if budget.category_ids_csv:
            for x in budget.category_ids_csv.split(","):
                if x.strip() and x.strip().isdigit():
                    target_cat_ids.append(int(x.strip()))
        elif budget.category_id:
            target_cat_ids = [budget.category_id]

        days_remaining = (budget.end_date - today).days

        # 📊 ROUTING MODE A: THE 50/30/20 MULTI-POOL TRACKING CALCULATION
        if budget.strategy_type == "50_30_20":
            income_statement = select(func.sum(Transaction.amount)).where(
                Transaction.user_id == active_user_id,
                func.lower(Transaction.type) == "income",
                Transaction.transaction_date >= budget.start_date,
                Transaction.transaction_date <= budget.end_date
            )
            raw_income = session.exec(income_statement).first()
            total_income = float(raw_income) if raw_income is not None else 0.0

            n_pct = budget.needs_percentage or 50
            w_pct = budget.wants_percentage or 30
            s_pct = budget.savings_percentage or 20

            needs_cap_allowance = (n_pct / 100.0) * total_income
            wants_cap_allowance = (w_pct / 100.0) * total_income
            savings_target_allocation = (s_pct / 100.0) * total_income

            wants_spent = 0.0
            if target_cat_ids:
                wants_statement = select(func.sum(Transaction.amount)).where(
                    Transaction.user_id == active_user_id,
                    func.lower(Transaction.type) == "expense",
                    Transaction.category_id.in_(target_cat_ids),
                    Transaction.transaction_date >= budget.start_date,
                    Transaction.transaction_date <= budget.end_date
                )
                raw_wants = session.exec(wants_statement).first()
                wants_spent = float(raw_wants) if raw_wants is not None else 0.0

            needs_statement = select(func.sum(Transaction.amount)).where(
                Transaction.user_id == active_user_id,
                func.lower(Transaction.type) == "expense",
                Transaction.transaction_date >= budget.start_date,
                Transaction.transaction_date <= budget.end_date
            )
            if target_cat_ids:
                needs_statement = needs_statement.where(Transaction.category_id.not_in(target_cat_ids))

            raw_needs = session.exec(needs_statement).first()
            needs_spent = float(raw_needs) if raw_needs is not None else 0.0

            total_spent_overall = needs_spent + wants_spent
            retained_leftovers = total_income - total_spent_overall

            wants_progress = round((wants_spent / wants_cap_allowance) * 100) if wants_cap_allowance > 0 else 0

            if wants_progress >= 100:
                status_flag = "red"
                alert_message = f"🚨 Strategy Alert: Your Lifestyle 'Wants' pool has exceeded its {w_pct}% limit by ${abs(wants_cap_allowance - wants_spent):.2f}!"
            elif wants_progress >= 80:
                status_flag = "amber"
                alert_message = f"⚠️ Warning: Lifestyle 'Wants' tracking metric has consumed {wants_progress}% of its allowed strategy room."
            else:
                status_flag = "green"
                alert_message = f"🎉 Strategy Engaged: You have generated ${max(0.0, retained_leftovers):.2f} total retained leftovers so far."

            calculated_response.append({
                "id": budget.id,
                "name": budget.name,
                "start": budget.start_date.strftime("%m/%d/%Y"),
                "end": budget.end_date.strftime("%m/%d/%Y"),
                "spent": total_spent_overall,
                "current": total_spent_overall,
                "total": total_income,
                "progress": wants_progress,
                "residual": wants_cap_allowance - wants_spent,
                "status": status_flag,
                "days_left": days_remaining,
                "alert_message": alert_message,
                "strategy_type": budget.strategy_type,
                "is_group_budget": True,
                "is_rollover": False,
                "category_id": budget.category_id,
                "category_ids_csv": budget.category_ids_csv,
                "income_pool": total_income,
                "needs_allocation": {
                    "pct": n_pct,
                    "allowed": needs_cap_allowance,
                    "spent": needs_spent
                },
                "wants_allocation": {
                    "pct": w_pct,
                    "allowed": wants_cap_allowance,
                    "spent": wants_spent
                },
                "savings_allocation": {
                    "pct": s_pct,
                    "target_goal": savings_target_allocation,
                },
                "retained_leftovers": max(0.0, retained_leftovers),
                "img": f"https://api.dicebear.com/7.x/identicon/svg?seed=strategy-{budget.id}"
            })
            continue

        # 📊 ROUTING MODE B: STANDALONE DEFAULT MODE (Spending Cap & Fixed Allocation)
        limit_float = float(budget.monthly_limit)
        alert_message = None
        status_flag = "green"

        if not target_cat_ids:
            total_spent = Decimal("0.00")
        else:
            spending_statement = select(func.sum(Transaction.amount)).where(
                func.lower(Transaction.type) == "expense",
                Transaction.category_id.in_(target_cat_ids),
                Transaction.transaction_date >= budget.start_date,
                Transaction.transaction_date <= budget.end_date
            )
            raw_sum = session.exec(spending_statement).first()
            total_spent = Decimal(str(raw_sum)) if raw_sum is not None else Decimal("0.00")

        spent_float = float(total_spent)
        residual_pocket_balance = limit_float - spent_float
        progress_percentage = round((spent_float / limit_float) * 100) if limit_float > 0 else 0

        if budget.strategy_type == "fixed_allocation":
            if spent_float < limit_float:
                if days_remaining < 0:
                    status_flag = "red"
                    alert_message = f"🚨 Overdue! Your commitment for '{budget.name}' was due {abs(days_remaining)} days ago."
                elif days_remaining == 0:
                    status_flag = "red"
                    alert_message = f"⏰ Due Today! Don't forget to clear your ${limit_float:.2f} {budget.name} allocation."
                elif days_remaining <= 5:
                    status_flag = "amber"
                    alert_message = f"⚠️ Reminder: You only have {days_remaining} days left until your {budget.name} payment deadline!"
            else:
                status_flag = "green"
                alert_message = f"✅ Settled: Fixed commitment allocation for {budget.name} fully cleared."
        else:
            if progress_percentage >= 100:
                status_flag = "red"
                alert_message = f"🚨 Alert: You have completely blown past your maximum budget for {budget.name} by ${abs(residual_pocket_balance):.2f}!"
            elif progress_percentage >= 80:
                status_flag = "amber"
                alert_message = f"⚠️ Careful: You have consumed {progress_percentage}% of your spending limit for {budget.name}."

        calculated_response.append({
            "id": budget.id,
            "name": budget.name,
            "start": budget.start_date.strftime("%m/%d/%Y"),
            "end": budget.end_date.strftime("%m/%d/%Y"),
            "spent": spent_float,
            "current": spent_float,
            "total": limit_float,
            "progress": progress_percentage,
            "residual": residual_pocket_balance,
            "status": status_flag,
            "days_left": days_remaining,
            "alert_message": alert_message,
            "strategy_type": budget.strategy_type,
            "is_group_budget": budget.is_group_budget,
            "is_rollover": budget.is_rollover,
            "category_id": budget.category_id,
            "category_ids_csv": budget.category_ids_csv,
            "img": f"https://api.dicebear.com/7.x/identicon/svg?seed={budget.id}"
        })

    return calculated_response


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, session: SessionDep):
    """
    Permanently deletes a budget threshold rule.
    """
    budget = session.get(Budget, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    try:
        session.delete(budget)
        session.commit()
        return {"message": "Budget rule configuration cleared successfully"}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Deletion Error: {str(e)}")