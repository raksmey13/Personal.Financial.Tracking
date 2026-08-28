import sys
import os
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from sqlmodel import select, func
from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionDep
from models import Account, Transaction, Category, User
from .auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["Accounts"])


class AccountCreate(BaseModel):
    account_name: str
    account_type: str
    balance: float = 0.0
    credit_limit: float = 0.0
    currency: str = "USD"
    is_savings_target: bool = False
    payment_due_day: Optional[int] = None
    note: Optional[str] = None


class AccountResponse(BaseModel):
    id: Optional[int]
    account_name: str
    account_type: str
    balance: float
    credit_limit: float
    currency: str
    is_active: bool
    is_savings_target: bool
    payment_due_day: Optional[int] = None
    note: Optional[str] = None
    initial_balance: float

    class Config:
        from_attributes = True


def reset_other_savings_targets(session: SessionDep, user_id: int, current_account_id: Optional[int] = None):
    """
    Ensures only a single active account acts as the master vault for the 50/30/20 budget sweeps.
    """
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
def create_account(
    account_input: AccountCreate,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    existing_account = session.exec(
        select(Account).where(
            func.lower(Account.account_name) == func.lower(account_input.account_name),
            Account.user_id == current_user.id
        )
    ).first()

    if existing_account and existing_account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active account named '{account_input.account_name}' already exists."
        )

    try:
        starting_amount = Decimal(str(account_input.balance or 0.0))
        # 🟢 REMOVED: Auto-detection based on the word "saving" in account_name
        should_be_savings_target = account_input.is_savings_target

        # Reactivate existing soft-deleted account
        if existing_account and not existing_account.is_active:
            old_transactions = session.exec(
                select(Transaction).where(Transaction.account_id == existing_account.id)
            ).all()
            for old_tx in old_transactions:
                session.delete(old_tx)

            session.commit()

            existing_account = session.exec(
                select(Account).where(Account.id == existing_account.id)
            ).first()

            existing_account.is_active = True
            existing_account.account_type = account_input.account_type
            existing_account.balance = starting_amount
            existing_account.credit_limit = Decimal(str(account_input.credit_limit or 0.0))
            existing_account.currency = account_input.currency
            existing_account.is_savings_target = should_be_savings_target
            existing_account.payment_due_day = account_input.payment_due_day
            existing_account.note = account_input.note

            target_account = existing_account
            session.add(target_account)
        else:
            target_account = Account(
                account_name=account_input.account_name,
                account_type=account_input.account_type,
                balance=starting_amount,
                credit_limit=Decimal(str(account_input.credit_limit or 0.0)),
                currency=account_input.currency,
                is_active=True,
                is_savings_target=should_be_savings_target,
                payment_due_day=account_input.payment_due_day,
                note=account_input.note,
                user_id=current_user.id
            )
            session.add(target_account)

        session.flush()

        if target_account.is_savings_target:
            reset_other_savings_targets(session, current_user.id, current_account_id=target_account.id)

        # 🟢 UPDATED: Classify opening baseline as neutral 'transfer' instead of income/expense
        if starting_amount != Decimal("0.00"):
            default_category = session.exec(
                select(Category).where(
                    Category.user_id == current_user.id,
                    Category.name == "Opening Balance"
                )
            ).first()

            if not default_category:
                default_category = session.exec(
                    select(Category).where(Category.user_id == current_user.id)
                ).first()

            if not default_category:
                default_category = Category(
                    name="Opening Balance",
                    type="transfer",
                    icon="wallet",
                    user_id=current_user.id
                )
                session.add(default_category)
                session.flush()

            opening_tx = Transaction(
                account_id=target_account.id,
                user_id=current_user.id,
                amount=abs(starting_amount),
                type="transfer",  # 🟢 Neutralized transaction type to prevent graph distortion
                description="Opening Balance Baseline",
                transaction_date=datetime.now().date(),
                category_id=default_category.id
            )
            session.add(opening_tx)

        session.commit()
        session.refresh(target_account)
        return target_account

    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database Insertion Error: {str(e)}"
        )


@router.get("/", response_model=List[AccountResponse])
def read_accounts(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    active_accounts = session.exec(
        select(Account).where(Account.is_active == True, Account.user_id == current_user.id).order_by(Account.id)
    ).all()

    response_payloads = []

    for acc in active_accounts:
        true_balance = float(acc.balance or 0.0)

        response_payloads.append(AccountResponse(
            id=acc.id,
            account_name=acc.account_name,
            account_type=acc.account_type,
            balance=true_balance,
            credit_limit=float(acc.credit_limit or 0.0),
            currency=acc.currency or "USD",
            is_active=acc.is_active,
            is_savings_target=acc.is_savings_target,
            payment_due_day=acc.payment_due_day,
            note=acc.note,
            initial_balance=true_balance
        ))

    return response_payloads


@router.put("/{account_id}", response_model=Account)
def update_account(
    account_id: int,
    updated_account: AccountCreate,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    db_account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    ).first()

    if not db_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or access denied."
        )

    account_data = updated_account.model_dump(exclude_unset=True)
    for key, value in account_data.items():
        if key not in ["id", "user_id"] and hasattr(db_account, key):
            if key in ["balance", "credit_limit"]:
                setattr(db_account, key, Decimal(str(value or 0.0)))
            else:
                setattr(db_account, key, value)

    try:
        if db_account.is_savings_target:
            reset_other_savings_targets(session, current_user.id, current_account_id=db_account.id)

        session.add(db_account)
        session.commit()
        session.refresh(db_account)
        return db_account
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database Update Error: {str(e)}"
        )


@router.delete("/{account_id}")
def delete_account(
    account_id: int,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """
    Soft-deletes the account and removes it as a savings target to prevent 50/30/20 sweep failures.
    """
    db_account = session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    ).first()

    if not db_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found or access denied."
        )

    db_account.is_active = False
    db_account.is_savings_target = False

    session.add(db_account)
    session.commit()
    return {"message": "Account soft-deleted successfully"}