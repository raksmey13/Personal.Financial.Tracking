from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from datetime import date
from decimal import Decimal
from pydantic import BaseModel
from sqlmodel import select, func
from database import SessionDep
from models import Transaction, Account, Category, Budget, User
from .auth import get_current_user
from .notification import check_and_trigger_notifications

router = APIRouter(prefix="/transactions", tags=["Transactions"])


class TransactionCreatePayload(BaseModel):
    amount: float
    category_id: int
    account_id: int
    description: Optional[str] = None
    transaction_date: date
    type: str
    to_account_id: Optional[int] = None
    interest_amount: Optional[float] = 0.0

def is_debt_liability(description: str, category_name: str) -> bool:
    desc_lower = description.lower() if description else ""
    cat_lower = category_name.lower().strip() if category_name else ""
    return (
            "credit card" in desc_lower or
            "card" in cat_lower or
            "credit" in cat_lower or
            ("loan" in cat_lower and "fee" not in desc_lower)
    )

def sync_debt_account(session: SessionDep, user_id: int, amount: Decimal, operation: str):
    all_accounts = session.exec(select(Account).where(
        Account.is_active == True,
        Account.user_id == user_id
    )).all()

    target_debt_account = next(
        (a for a in all_accounts if
         "credit" in a.account_type.lower() or "card" in a.account_type.lower() or "credit" in a.account_name.lower() or "loan" in a.account_type.lower() or "loan" in a.account_name.lower()),
        None
    )

    if target_debt_account:
        if operation == "subtract":
            target_debt_account.balance -= amount
        elif operation == "add":
            target_debt_account.balance += amount
        session.add(target_debt_account)


# 1. CREATE TRANSACTION (USER SCOPED)
@router.post("/", response_model=Transaction, status_code=status.HTTP_201_CREATED)
def create_transaction(
        payload: TransactionCreatePayload,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    principal = abs(Decimal(str(payload.amount)))
    interest = abs(Decimal(str(payload.interest_amount or 0.0)))
    total_cash_leaving = principal + interest

    source_account = session.exec(select(Account).where(
        Account.id == payload.account_id,
        Account.user_id == current_user.id
    )).first()
    if not source_account:
        raise HTTPException(status_code=404, detail="Source processing account not found")

    category = session.get(Category, payload.category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Target accounting metric category not found")

    tx_type_lower = payload.type.lower()
    is_debt = is_debt_liability(payload.description, category.name)

    sweep_occurred = False
    sweep_val = Decimal("0.00")

    if tx_type_lower == "transfer" and payload.to_account_id:
        target_account = session.exec(select(Account).where(
            Account.id == payload.to_account_id,
            Account.user_id == current_user.id
        )).first()
        if not target_account:
            raise HTTPException(status_code=404, detail="Destination target account not found")

        source_account.balance -= total_cash_leaving
        target_account_type = target_account.account_type.lower()
        target_account_name = target_account.account_name.lower()
        is_target_debt = "credit" in target_account_type or "card" in target_account_type or "loan" in target_account_type or "loan" in target_account_name or "credit" in target_account_name

        if is_target_debt:
            # 🟢 FIXED: Paying down a loan/credit card liability reduces the owed balance (moves closer to 0)
            if target_account.balance < 0:
                target_account.balance += principal
            else:
                target_account.balance -= principal
        else:
            target_account.balance += principal

        session.add(source_account)
        session.add(target_account)
        main_tx = Transaction(
            user_id=current_user.id,
            amount=-abs(Decimal(str(principal))),
            category_id=payload.category_id,
            account_id=payload.account_id,
            to_account_id=payload.to_account_id,
            transaction_date=payload.transaction_date,
            type="transfer",
            description=payload.description or "Loan Payment / Principal Reduction"
        )
        session.add(main_tx)


        if interest > 0:
            interest_tx = Transaction(
                user_id=current_user.id,
                amount=-abs(Decimal(str(interest))),
                category_id=payload.category_id,
                account_id=payload.account_id,
                transaction_date=payload.transaction_date,
                type="expense",
                description=f"Loan Interest Fee (Added to {payload.description or 'payment'})"
            )
            session.add(interest_tx)

        session.commit()
        session.refresh(main_tx)

        try:
            check_and_trigger_notifications(
                user_id=current_user.id, account_id=payload.to_account_id, category_id=payload.category_id,
                session=session, tx_date=payload.transaction_date, sweep_triggered=False,
                sweep_amount=Decimal("0.00")
            )
        except Exception as e:
            print(f"Notification engine warning: {e}")

        return main_tx

    # --- PHASE 1: PROCESS BASELINE TRANSACTIONS ---
    if tx_type_lower == "income":
        source_account.balance += principal
    elif tx_type_lower == "expense":
        source_account.balance -= principal
        if is_debt:
            sync_debt_account(session, current_user.id, principal, "subtract")
    elif tx_type_lower == "transfer":
        if source_account.is_savings_target:
            source_account.balance += principal
        else:
            source_account.balance -= principal
            if is_debt:
                sync_debt_account(session, current_user.id, principal, "subtract")
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type")

    recorded_amount = principal if tx_type_lower == "income" else -abs(principal)

    transaction = Transaction(
        user_id=current_user.id,
        amount=recorded_amount,
        category_id=payload.category_id,
        account_id=payload.account_id,
        transaction_date=payload.transaction_date,
        type=tx_type_lower,
        description=payload.description
    )
    session.add(transaction)
    session.add(source_account)
    cat_name_lower = category.name.lower().strip()
    if (
            tx_type_lower == "income"
            and not is_debt
            and "sweep" not in cat_name_lower
            and "saving" not in cat_name_lower
            and not source_account.is_savings_target
    ):
        active_strategy = session.exec(
            select(Budget).where(
                Budget.strategy_type == "50_30_20",
                Budget.is_active == True,
                Budget.user_id == current_user.id
            )
        ).first()

        if active_strategy:
            savings_account = session.exec(
                select(Account).where(
                    Account.user_id == current_user.id,
                    Account.is_active == True,
                    Account.is_savings_target == True
                )
            ).first()

            if savings_account:
                savings_pct = active_strategy.savings_percentage or 20
                sweep_amount = float(principal) * (savings_pct / 100.0)

                if sweep_amount > 0:
                    sweep_category = session.exec(
                        select(Category).where(
                            Category.user_id == current_user.id,
                            func.lower(Category.name).contains("sweep saving")
                        )
                    ).first()

                    if not sweep_category:
                        sweep_category = session.exec(
                            select(Category).where(
                                Category.user_id == current_user.id,
                                (func.lower(Category.name).contains("sweep")) |
                                (func.lower(Category.name).contains("transfer"))
                            )
                        ).first()

                    category_id_to_use = sweep_category.id if sweep_category else None

                    outflow_transfer = Transaction(
                        user_id=current_user.id,
                        amount=-abs(Decimal(str(sweep_amount))),
                        type="transfer",
                        account_id=payload.account_id,
                        category_id=category_id_to_use,
                        transaction_date=payload.transaction_date,
                        description=f"🤖 Auto Sweep Outflow ({payload.description or 'Income Allocation'})"
                    )

                    inflow_transfer = Transaction(
                        user_id=current_user.id,
                        amount=abs(Decimal(str(sweep_amount))),
                        type="transfer",
                        account_id=savings_account.id,
                        category_id=category_id_to_use,
                        transaction_date=payload.transaction_date,
                        description=f"🤖 Auto Sweep Inflow ({payload.description or 'Income Allocation'})"
                    )

                    source_account.balance -= Decimal(str(sweep_amount))
                    savings_account.balance += Decimal(str(sweep_amount))

                    session.add_all([outflow_transfer, inflow_transfer, source_account, savings_account])
                    sweep_occurred = True
                    sweep_val = Decimal(str(sweep_amount))

    session.commit()
    session.refresh(transaction)

    try:
        check_and_trigger_notifications(
            user_id=current_user.id, account_id=payload.account_id, category_id=payload.category_id,
            session=session, tx_date=payload.transaction_date, sweep_triggered=sweep_occurred,
            sweep_amount=sweep_val
        )
    except Exception as e:
        print(f"Notification engine warning: {e}")

    return transaction


# 2. READ TRANSACTIONS (USER SCOPED)
@router.get("/", response_model=List[Transaction])
def read_transactions(
        session: SessionDep,
        current_user: User = Depends(get_current_user),
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
):
    statement = select(Transaction).where(Transaction.user_id == current_user.id)
    if start_date and end_date:
        statement = statement.where(Transaction.transaction_date >= start_date)
        statement = statement.where(Transaction.transaction_date <= end_date)
    statement = statement.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
    return session.exec(statement).all()

@router.delete("/{transaction_id}")
def delete_transaction(
        transaction_id: int,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    transaction = session.exec(select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    )).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Target ledger trace record not found")

    source_account = session.get(Account, transaction.account_id)
    target_account = session.get(Account, transaction.to_account_id) if transaction.to_account_id else None
    category = session.get(Category, transaction.category_id)

    if source_account:
        tx_type_lower = transaction.type.lower()
        abs_amt = abs(transaction.amount)

        if tx_type_lower == "income":
            source_account.balance -= abs_amt
        elif tx_type_lower == "expense":
            source_account.balance += abs_amt
        elif tx_type_lower == "transfer":
            if source_account.is_savings_target:
                source_account.balance -= abs_amt
            else:
                source_account.balance += abs_amt
        session.add(source_account)

    if target_account and transaction.type.lower() == "transfer":
        target_type = target_account.account_type.lower()
        target_name = target_account.account_name.lower()
        is_target_debt = "credit" in target_type or "card" in target_type or "loan" in target_type or "loan" in target_name or "credit" in target_name
        abs_amt = abs(transaction.amount)

        if is_target_debt:
            if target_account.balance < 0:
                target_account.balance -= abs_amt
            else:
                target_account.balance += abs_amt
        else:
            target_account.balance -= abs_amt
        session.add(target_account)

    session.delete(transaction)
    session.commit()

    try:
        check_and_trigger_notifications(
            user_id=current_user.id, account_id=transaction.account_id, category_id=transaction.category_id,
            tx_date=transaction.transaction_date, session=session
        )
    except Exception as e:
        print(f"Notification engine warning on delete evaluation: {e}")

    return {"message": "Transaction cleared successfully", "status": 200}


@router.put("/{transaction_id}", response_model=Transaction)
def update_transaction(
        transaction_id: int,
        updated_tx: Transaction,
        session: SessionDep,
        current_user: User = Depends(get_current_user)
):
    db_transaction = session.exec(select(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id
    )).first()

    if not db_transaction:
        raise HTTPException(status_code=404, detail="Target transaction modification block not found")

    old_account = session.get(Account, db_transaction.account_id)
    new_account = session.exec(select(Account).where(
        Account.id == updated_tx.account_id,
        Account.user_id == current_user.id
    )).first()

    old_category = session.get(Category, db_transaction.category_id)
    new_category = session.get(Category, updated_tx.category_id)

    if not new_account:
        raise HTTPException(status_code=404, detail="New targeted account not found")

    if old_account:
        old_tx_type = db_transaction.type.lower()
        old_cat_name = old_category.name if old_category else ""
        is_old_debt = is_debt_liability(db_transaction.description, old_cat_name)
        old_abs_amt = abs(db_transaction.amount)

        if old_tx_type == "income":
            old_account.balance -= old_abs_amt
        elif old_tx_type == "expense":
            old_account.balance += old_abs_amt
            if is_old_debt:
                sync_debt_account(session, current_user.id, old_abs_amt, "add")
        elif old_tx_type == "transfer":
            if old_account.is_savings_target:
                old_account.balance -= old_abs_amt
            else:
                old_account.balance += old_abs_amt
                if is_old_debt:
                    sync_debt_account(session, current_user.id, old_abs_amt, "add")
        session.add(old_account)

    new_tx_type = updated_tx.type.lower()
    new_cat_name = new_category.name if new_category else ""
    is_new_debt = is_debt_liability(updated_tx.description, new_cat_name)
    new_abs_amt = abs(updated_tx.amount)
    correct_amount = new_abs_amt if new_tx_type == "income" else -abs(new_abs_amt)

    if new_tx_type == "income":
        new_account.balance += new_abs_amt
    elif new_tx_type == "expense":
        new_account.balance -= new_abs_amt
        if is_new_debt:
            sync_debt_account(session, current_user.id, new_abs_amt, "subtract")
    elif new_tx_type == "transfer":
        if new_account.is_savings_target:
            new_account.balance += new_abs_amt
        else:
            new_account.balance -= new_abs_amt
            if is_new_debt:
                sync_debt_account(session, current_user.id, new_abs_amt, "subtract")
    session.add(new_account)

    update_data = updated_tx.model_dump(exclude_unset=True)
    update_data.pop("id", None)
    update_data["user_id"] = current_user.id
    update_data["amount"] = correct_amount

    db_transaction.sqlmodel_update(update_data)

    session.add(db_transaction)
    session.commit()
    session.refresh(db_transaction)

    try:
        check_and_trigger_notifications(
            user_id=current_user.id, account_id=db_transaction.account_id,
            category_id=db_transaction.category_id,
            tx_date=db_transaction.transaction_date, session=session
        )
    except Exception as e:
        print(f"Notification engine warning on update evaluation: {e}")
    return db_transaction