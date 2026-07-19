from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import date
from decimal import Decimal
from sqlmodel import select, func
from database import SessionDep
from models import Transaction, Account, Category, Budget

# 🟢 FIXED: Safe sibling module tracking configuration path
from .notification import check_and_trigger_notifications

router = APIRouter(prefix="/transactions", tags=["Transactions"])


# 1. CREATE TRANSACTION (With Balanced 50/30/20 Sweeps & Liability Syncing)
@router.post("/", response_model=Transaction, status_code=status.HTTP_201_CREATED)
def create_transaction(transaction: Transaction, session: SessionDep):
    account = session.get(Account, transaction.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Target processing account asset not found")

    category = session.get(Category, transaction.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Target accounting metric category not found")

    # 🛑 CRITICAL SAFEGUARD INTERCEPTOR:
    # Force the type to 'transfer' if it's explicitly a debt/liability payment line,
    # preventing it from ever being misclassified as income and triggering unintended sweeps.
    desc_lower = transaction.description.lower() if transaction.description else ""
    cat_name_lower = category.name.lower().strip()

    if (
            "credit card" in desc_lower
            or "loan payment" in desc_lower
            or "card" in cat_name_lower
            or "credit" in cat_name_lower
            or "loan" in cat_name_lower
    ):
        transaction.type = "transfer"

    tx_type_lower = transaction.type.lower()

    # Tracking metrics for custom success logs
    sweep_occurred = False
    sweep_val = Decimal("0.00")

    # --- PHASE 1: PROCESS BASELINE TRANSACTIONS ---
    if tx_type_lower == "income":
        account.balance += transaction.amount
    elif tx_type_lower == "expense":
        account.balance -= transaction.amount
    elif tx_type_lower == "transfer":
        if account.is_savings_target:
            account.balance += transaction.amount
        else:
            account.balance -= transaction.amount

            all_accounts = session.exec(select(Account).where(
                Account.is_active == True,
                Account.user_id == transaction.user_id
            )).all()

            target_debt_account = None
            if "card" in cat_name_lower or "credit" in cat_name_lower:
                target_debt_account = next((a for a in all_accounts if
                                            "credit" in a.account_type.lower() or "card" in a.account_type.lower() or "credit" in a.account_name.lower()),
                                           None)
            elif "loan" in cat_name_lower:
                target_debt_account = next(
                    (a for a in all_accounts if "loan" in a.account_type.lower() or "loan" in a.account_name.lower()),
                    None)

            if target_debt_account:
                target_debt_account.balance -= transaction.amount
                session.add(target_debt_account)
    else:
        raise HTTPException(status_code=400, detail="Invalid dynamic transaction categorization string type")

    transaction.id = None
    session.add(transaction)
    session.add(account)

    # --- PHASE 2: ATOMIC STRATEGY INTERCEPTOR SWEEPS ---
    if (
            tx_type_lower == "income"
            and "sweep" not in cat_name_lower
            and "saving" not in cat_name_lower
            and not account.is_savings_target
    ):
        active_strategy = session.exec(
            select(Budget).where(
                Budget.strategy_type == "50_30_20",
                Budget.start_date <= transaction.transaction_date,
                Budget.end_date >= transaction.transaction_date,
                Budget.user_id == transaction.user_id
            )
        ).first()

        if active_strategy:
            savings_account = session.exec(
                select(Account).where(
                    Account.user_id == transaction.user_id,
                    Account.is_active == True,
                    Account.is_savings_target == True
                )
            ).first()

            if savings_account:
                savings_pct = active_strategy.savings_percentage or 20
                sweep_amount = float(transaction.amount) * (savings_pct / 100.0)

                if sweep_amount > 0:
                    transfer_category = session.exec(
                        select(Category).where(
                            (func.lower(Category.name).contains("transfer")) |
                            (func.lower(Category.name).contains("sweep")) |
                            (func.lower(Category.name).contains("saving"))
                        )
                    ).first()

                    if transfer_category:
                        category_id_to_use = transfer_category.id
                    else:
                        category_id_to_use = transaction.category_id

                    outflow_transfer = Transaction(
                        user_id=transaction.user_id,
                        amount=Decimal(str(sweep_amount)),
                        type="transfer",
                        account_id=transaction.account_id,
                        category_id=category_id_to_use,
                        transaction_date=transaction.transaction_date,
                        description=f"🤖 Auto Sweep Outflow ({transaction.description or 'Income Allocation'})"
                    )

                    inflow_transfer = Transaction(
                        user_id=transaction.user_id,
                        amount=Decimal(str(sweep_amount)),
                        type="transfer",
                        account_id=savings_account.id,
                        category_id=category_id_to_use,
                        transaction_date=transaction.transaction_date,
                        description=f"🤖 Auto Sweep Inflow ({transaction.description or 'Income Allocation'})"
                    )

                    account.balance -= Decimal(str(sweep_amount))
                    savings_account.balance += Decimal(str(sweep_amount))

                    session.add(outflow_transfer)
                    session.add(inflow_transfer)
                    session.add(account)
                    session.add(savings_account)

                    sweep_occurred = True
                    sweep_val = Decimal(str(sweep_amount))

    session.commit()
    session.refresh(transaction)

    # 🟢 EVALUATE AND GENERATE LIVE SYSTEM NOTIFICATIONS
    try:
        check_and_trigger_notifications(
            user_id=transaction.user_id,
            account_id=transaction.account_id,
            category_id=transaction.category_id,
            session=session,
            tx_date=transaction.transaction_date,  # Pass payload execution date
            sweep_triggered=sweep_occurred,
            sweep_amount=sweep_val
        )
    except Exception as e:
        print(f"Notification engine warning: {e}")

    return transaction


# 2. READ TRANSACTIONS
@router.get("/", response_model=List[Transaction])
def read_transactions(session: SessionDep, start_date: Optional[date] = None, end_date: Optional[date] = None):
    statement = select(Transaction)
    if start_date and end_date:
        statement = statement.where(Transaction.transaction_date >= start_date)
        statement = statement.where(Transaction.transaction_date <= end_date)

    # 💡 FIXED: Order by date first, then ensure the highest ID sits at the top for same-day items
    statement = statement.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    return session.exec(statement).all()


# 3. DELETE TRANSACTION
@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: int, session: SessionDep):
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Target ledger trace record not found")

    account = session.get(Account, transaction.account_id)
    category = session.get(Category, transaction.category_id)

    if account:
        tx_type_lower = transaction.type.lower()
        if tx_type_lower == "income":
            account.balance -= transaction.amount
        elif tx_type_lower == "expense":
            account.balance += transaction.amount
        elif tx_type_lower == "transfer":
            if account.is_savings_target:
                account.balance -= transaction.amount
            else:
                account.balance += transaction.amount

                all_accounts = session.exec(select(Account).where(
                    Account.is_active == True,
                    Account.user_id == transaction.user_id
                )).all()

                target_debt_account = None
                if category:
                    if "card" in category.name.lower() or "credit" in category.name.lower():
                        target_debt_account = next((a for a in all_accounts if
                                                    "credit" in a.account_type.lower() or "card" in a.account_type.lower() or "credit" in a.account_name.lower()),
                                                   None)
                    elif "loan" in category.name.lower():
                        target_debt_account = next((a for a in all_accounts if
                                                    "loan" in a.account_type.lower() or "loan" in a.account_name.lower()),
                                                   None)

                if target_debt_account:
                    target_debt_account.balance += transaction.amount
                    session.add(target_debt_account)

        session.add(account)

    session.delete(transaction)
    session.commit()

    # 🟢 EVALUATE NOTIFICATIONS AFTER REMOVAL
    try:
        check_and_trigger_notifications(
            user_id=transaction.user_id,
            account_id=transaction.account_id,
            category_id=transaction.category_id,
            tx_date=transaction.transaction_date,
            session=session
        )
    except Exception as e:
        print(f"Notification engine warning on delete evaluation: {e}")

    return {"message": "Transaction cleared successfully", "status": 200}


# 4. UPDATE TRANSACTION
@router.put("/{transaction_id}", response_model=Transaction)
def update_transaction(transaction_id: int, updated_tx: Transaction, session: SessionDep):
    db_transaction = session.get(Transaction, transaction_id)
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Target transaction modification block not found")

    old_account = session.get(Account, db_transaction.account_id)
    new_account = session.get(Account, updated_tx.account_id)
    old_category = session.get(Category, db_transaction.category_id)
    new_category = session.get(Category, updated_tx.category_id)

    if not new_account:
        raise HTTPException(status_code=404, detail="New targeted account not found")

    if old_account:
        old_tx_type = db_transaction.type.lower()
        if old_tx_type == "income":
            old_account.balance -= db_transaction.amount
        elif old_tx_type == "expense":
            old_account.balance += db_transaction.amount
        elif old_tx_type == "transfer":
            if old_account.is_savings_target:
                old_account.balance -= db_transaction.amount
            else:
                old_account.balance += db_transaction.amount
                all_accounts = session.exec(select(Account).where(
                    Account.is_active == True,
                    Account.user_id == db_transaction.user_id
                )).all()
                target_debt_account = None
                if old_category:
                    if "card" in old_category.name.lower() or "credit" in old_category.name.lower():
                        target_debt_account = next((a for a in all_accounts if
                                                    "credit" in a.account_type.lower() or "card" in a.account_type.lower() or "credit" in a.account_name.lower()),
                                                   None)
                    elif "loan" in old_category.name.lower():
                        target_debt_account = next((a for a in all_accounts if
                                                    "loan" in old_category.name.lower() or "loan" in old_account.account_name.lower()),
                                                   None)
                if target_debt_account:
                    target_debt_account.balance += db_transaction.amount
                    session.add(target_debt_account)
        session.add(old_account)

    # Apply entering interceptor for updates too
    desc_lower = updated_tx.description.lower() if updated_tx.description else ""
    new_cat_name_lower = new_category.name.lower().strip() if new_category else ""
    if (
            "credit card" in desc_lower
            or "loan payment" in desc_lower
            or "card" in new_cat_name_lower
            or "credit" in new_cat_name_lower
            or "loan" in new_cat_name_lower
    ):
        updated_tx.type = "transfer"

    new_tx_type = updated_tx.type.lower()
    if new_tx_type == "income":
        new_account.balance += updated_tx.amount
    elif new_tx_type == "expense":
        new_account.balance -= updated_tx.amount
    elif new_tx_type == "transfer":
        if new_account.is_savings_target:
            new_account.balance += updated_tx.amount
        else:
            new_account.balance -= updated_tx.amount
            all_accounts = session.exec(select(Account).where(
                Account.is_active == True,
                Account.user_id == updated_tx.user_id
            )).all()
            target_debt_account = None
            if new_category:
                if "card" in new_category.name.lower() or "credit" in new_category.name.lower():
                    target_debt_account = next((a for a in all_accounts if
                                                "credit" in a.account_type.lower() or "card" in a.account_type.lower() or "credit" in a.account_name.lower()),
                                               None)
                elif "loan" in new_category.name.lower():
                    target_debt_account = next(
                        (a for a in all_accounts if
                         "loan" in a.account_type.lower() or "loan" in a.account_name.lower()),
                        None)
            if target_debt_account:
                target_debt_account.balance -= updated_tx.amount
                session.add(target_debt_account)
    session.add(new_account)

    update_data = updated_tx.model_dump(exclude_unset=True)
    update_data.pop("id", None)
    db_transaction.sqlmodel_update(update_data)

    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)

    # 🟢 EVALUATE NOTIFICATIONS ON TRANSACTION ADJUSTMENTS
    try:
        check_and_trigger_notifications(
            user_id=db_transaction.user_id,
            account_id=db_transaction.account_id,
            category_id=db_transaction.category_id,
            tx_date=db_transaction.transaction_date,
            session=session
        )
    except Exception as e:
        print(f"Notification engine warning on update evaluation: {e}")

    return db_transaction