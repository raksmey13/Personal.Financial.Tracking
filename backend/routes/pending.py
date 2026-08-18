from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlmodel import select
from database import SessionDep
from models import PendingTransaction, Transaction, BeneficiaryCategoryMap, User, Account
from .auth import get_current_user

router = APIRouter(prefix="/budgets/pending", tags=["Pending Ingestion"])


class ApprovePendingPayload(BaseModel):
    category_id: int
    remember_rule: bool = True


@router.get("/")
def get_pending_transactions(
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """Fetches all unapproved staged transactions for the authenticated user."""
    return session.exec(
        select(PendingTransaction).where(
            PendingTransaction.user_id == current_user.id,
            PendingTransaction.status == "pending"
        )
    ).all()


@router.post("/{pending_id}/approve")
def approve_pending_transaction(
    pending_id: int,
    payload: ApprovePendingPayload,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """
    Promotes a pending item to the main transactions table for the authenticated user,
    deducts account balance, and optionally saves the beneficiary mapping.
    """
    pending = session.exec(
        select(PendingTransaction).where(
            PendingTransaction.id == pending_id,
            PendingTransaction.user_id == current_user.id
        )
    ).first()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending item not found or access denied"
        )

    clean_amount = abs(pending.amount)

    # 1. Promote to main ledger bound to current user
    real_tx = Transaction(
        user_id=current_user.id,
        amount=-clean_amount,  # Negative for expense
        category_id=payload.category_id,
        account_id=pending.account_id,
        transaction_date=pending.transaction_date,
        description=f"KHQR: {pending.raw_beneficiary_name}",
        type="expense"
    )
    session.add(real_tx)

    # 2. Deduct from account balance
    acc_obj = session.get(Account, pending.account_id)
    if acc_obj:
        acc_obj.balance -= clean_amount
        session.add(acc_obj)

    # 3. Mark pending item as approved (or delete it from pending inbox)
    pending.status = "approved"
    session.add(pending)

    # 4. Save beneficiary memory rule if requested (user scoped)
    if payload.remember_rule:
        existing_map = session.exec(
            select(BeneficiaryCategoryMap).where(
                BeneficiaryCategoryMap.user_id == current_user.id,
                BeneficiaryCategoryMap.raw_name == pending.raw_beneficiary_name
            )
        ).first()

        if not existing_map:
            new_map = BeneficiaryCategoryMap(
                user_id=current_user.id,
                raw_name=pending.raw_beneficiary_name,
                category_id=payload.category_id
            )
            session.add(new_map)

    session.commit()
    return {"status": 200, "message": "Transaction approved successfully"}


# 🟢 ADDED: Delete / Reject endpoint for Pending Transactions
@router.delete("/{pending_id}")
@router.post("/{pending_id}/reject")
def reject_pending_transaction(
    pending_id: int,
    session: SessionDep,
    current_user: User = Depends(get_current_user)
):
    """
    Permanently deletes or rejects a staged item from the user's Pending Inbox.
    Handles both DELETE /{pending_id} and POST /{pending_id}/reject calls.
    """
    pending = session.exec(
        select(PendingTransaction).where(
            PendingTransaction.id == pending_id,
            PendingTransaction.user_id == current_user.id
        )
    ).first()

    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending item not found or access denied"
        )

    session.delete(pending)
    session.commit()
    return {"status": 200, "message": "Pending transaction rejected and deleted successfully"}