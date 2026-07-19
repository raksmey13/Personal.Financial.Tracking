import sys
import os
from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from sqlmodel import select, func
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

# Safe path injection to keep project environment stable
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionDep
from models import Account, Transaction, Category

router = APIRouter(prefix="/accounts", tags=["Accounts"])


# Request Schema DTO to safely parse incoming data
class AccountCreate(BaseModel):
    account_name: str
    account_type: str
    balance: float = 0.0
    credit_limit: float = 0.0
    is_savings_target: bool = False
    payment_due_day: Optional[int] = None
    note: Optional[str] = None


# Response Schema DTO
class AccountResponse(BaseModel):
    id: Optional[int]
    account_name: str
    account_type: str
    balance: float
    credit_limit: float
    is_active: bool
    is_savings_target: bool
    payment_due_day: Optional[int] = None
    note: Optional[str] = None
    initial_balance: float

    class Config:
        from_attributes = True


def reset_other_savings_targets(session: SessionDep, user_id: int, current_account_id: Optional[int] = None):
    query = select(Account).where(
        Account.user_id == user_id,
        Account.is_savings_target == True
    )
    if current_account_id is not None:
        query = query.where(Account.id != current_account_id)

    other_targets = session.exec(query).all()
    for old_acc in other_targets:
        old_acc.is_savings_target = False
        session.add(old_acc)


@router.post("/", response_model=Account)
def create_account(account_input: AccountCreate, session: SessionDep):
    ACTIVE_USER_ID = 1

    existing_account = session.exec(
        select(Account).where(
            func.lower(Account.account_name) == func.lower(account_input.account_name),
            Account.user_id == ACTIVE_USER_ID
        )
    ).first()

    if existing_account and existing_account.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"An active account named '{account_input.account_name}' already exists."
        )

    try:
        starting_amount = Decimal(str(account_input.balance or 0.0))
        input_name_lower = account_input.account_name.lower().strip()
        should_be_savings_target = account_input.is_savings_target or ("saving" in input_name_lower)

        # 3. Reactivate existing soft-deleted account
        if existing_account and not existing_account.is_active:

            # 🧹 STEP A: Force drop old transactions from the database immediately
            old_transactions = session.exec(
                select(Transaction).where(Transaction.account_id == existing_account.id)
            ).all()
            for old_tx in old_transactions:
                session.delete(old_tx)

            # 🧹 STEP B: Commit the deletions to completely purge the cache
            session.commit()

            # 🧹 STEP C: Re-fetch a pristine handle on the account record now that history is cleared
            existing_account = session.exec(
                select(Account).where(Account.id == existing_account.id)
            ).first()

            existing_account.is_active = True
            existing_account.account_type = account_input.account_type
            existing_account.balance = starting_amount
            existing_account.credit_limit = Decimal(str(account_input.credit_limit or 0.0))
            existing_account.is_savings_target = should_be_savings_target
            existing_account.payment_due_day = account_input.payment_due_day
            existing_account.note = account_input.note

            target_account = existing_account
            session.add(target_account)
        else:
            # 4. Create an entirely new account entry
            target_account = Account(
                account_name=account_input.account_name,
                account_type=account_input.account_type,
                balance=starting_amount,
                credit_limit=Decimal(str(account_input.credit_limit or 0.0)),
                is_active=True,
                is_savings_target=should_be_savings_target,
                payment_due_day=account_input.payment_due_day,
                note=account_input.note,
                user_id=ACTIVE_USER_ID
            )
            session.add(target_account)

        # STAGE CHANGES: Flush to database sandbox memory to populate the valid ID safely
        session.flush()

        if target_account.is_savings_target:
            reset_other_savings_targets(session, ACTIVE_USER_ID, current_account_id=target_account.id)

        # 6. Generate the baseline transaction statement (Only if > 0)
        if starting_amount != 0:
            is_debt = target_account.account_type.lower() in ["loan", "credit card", "credit_card"]

            opening_tx = Transaction(
                account_id=target_account.id,
                user_id=ACTIVE_USER_ID,
                amount=float(abs(starting_amount)),  # Clean conversion to standard float
                type="expense" if is_debt else "income",
                description="Opening Balance Baseline",
                transaction_date=datetime.now().date(),
                category_id=1
            )
            session.add(opening_tx)

        # FINAL ATOMIC COMMIT
        session.commit()
        session.refresh(target_account)
        return target_account

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Insertion Error: {str(e)}")


@router.get("/", response_model=List[AccountResponse])
def read_accounts(session: SessionDep):
    ACTIVE_USER_ID = 1

    active_accounts = session.exec(
        select(Account).where(
            Account.is_active == True,
            Account.user_id == ACTIVE_USER_ID
        ).order_by(Account.id)
    ).all()

    response_payloads = []

    for acc in active_accounts:
        total_income = session.exec(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id == acc.id,
                Transaction.user_id == ACTIVE_USER_ID,
                Transaction.type == "income"
            )
        ).one() or 0.0

        total_expense = session.exec(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id == acc.id,
                Transaction.user_id == ACTIVE_USER_ID,
                Transaction.type.in_(["expense", "transfer"])
            )
        ).one() or 0.0

        acc_type_lower = acc.account_type.lower().strip()

        transfer_inflows = 0.0
        if "credit" in acc_type_lower or "card" in acc_type_lower:
            transfer_inflows = session.exec(
                select(func.sum(Transaction.amount))
                .join(Category, Transaction.category_id == Category.id)
                .where(
                    Transaction.user_id == ACTIVE_USER_ID,
                    Transaction.type == "transfer",
                    func.lower(Category.name).contains("credit") | func.lower(Category.name).contains("card")
                )
            ).one() or 0.0
        elif "loan" in acc_type_lower:
            transfer_inflows = session.exec(
                select(func.sum(Transaction.amount))
                .join(Category, Transaction.category_id == Category.id)
                .where(
                    Transaction.user_id == ACTIVE_USER_ID,
                    Transaction.type == "transfer",
                    func.lower(Category.name).contains("loan")
                )
            ).one() or 0.0
        elif "savings" in acc_type_lower or "save" in acc_type_lower:
            transfer_inflows = session.exec(
                select(func.sum(Transaction.amount)).where(
                    Transaction.account_id == acc.id,
                    Transaction.user_id == ACTIVE_USER_ID,
                    Transaction.type == "transfer",
                    func.lower(Transaction.description).contains("inflow")
                )
            ).one() or 0.0

        has_transactions = session.exec(
            select(func.count(Transaction.id)).where(
                Transaction.account_id == acc.id,
                Transaction.user_id == ACTIVE_USER_ID
            )
        ).one() or 0

        if has_transactions == 0 and transfer_inflows == 0:
            calculated_balance = float(acc.balance or 0.0)
            initial_balance = float(acc.balance or 0.0)
        else:
            if acc_type_lower in ["loan", "credit card", "credit_card"]:
                calculated_balance = float(total_income) + float(transfer_inflows) - float(total_expense)
                initial_balance = float(total_expense)
            else:
                calculated_balance = float(total_income) + float(transfer_inflows) - float(total_expense)
                initial_balance = float(total_income)

        response_payloads.append(AccountResponse(
            id=acc.id,
            account_name=acc.account_name,
            account_type=acc.account_type,
            balance=calculated_balance,
            credit_limit=float(acc.credit_limit or 0.0),
            is_active=acc.is_active,
            is_savings_target=acc.is_savings_target,
            payment_due_day=acc.payment_due_day,
            note=acc.note,
            initial_balance=initial_balance
        ))

    return response_payloads


@router.put("/{account_id}", response_model=Account)
def update_account(account_id: int, updated_account: AccountCreate, session: SessionDep):
    ACTIVE_USER_ID = 1

    db_account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == ACTIVE_USER_ID)
    ).first()

    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found or access denied")

    account_data = updated_account.model_dump(exclude_unset=True)
    for key, value in account_data.items():
        if key not in ["id", "user_id"] and hasattr(db_account, key):
            if key in ["balance", "credit_limit"]:
                setattr(db_account, key, Decimal(str(value or 0.0)))
            else:
                setattr(db_account, key, value)

    try:
        if db_account.is_savings_target:
            reset_other_savings_targets(session, ACTIVE_USER_ID, current_account_id=db_account.id)

        session.add(db_account)
        session.commit()
        session.refresh(db_account)
        return db_account
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Database Update Error: {str(e)}")


@router.delete("/{account_id}")
def delete_account(account_id: int, session: SessionDep):
    ACTIVE_USER_ID = 1

    db_account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == ACTIVE_USER_ID)
    ).first()

    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found or access denied")

    db_account.is_active = False
    db_account.is_savings_target = False

    session.add(db_account)
    session.commit()
    return {"message": "Account soft-deleted successfully"}