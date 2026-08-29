from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from sqlmodel import select, func
from database import SessionDep
from models import User, Transaction, PendingTransaction
from routes.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# Helper dependency to enforce superadmin access
def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Superadmin privileges required."
        )
    return current_user



#  GLOBAL SYSTEM ANALYTICS
@router.get("/stats")
def get_admin_stats(session: SessionDep, _: User = Depends(require_admin)):
    """Fetches high-level system metrics for the admin dashboard."""
    total_users = session.exec(select(func.count(User.id))).one()
    total_transactions = session.exec(select(func.count(Transaction.id))).one()
    total_pending = session.exec(
        select(func.count(PendingTransaction.id)).where(PendingTransaction.status == "pending")
    ).one()

    return {
        "total_users": total_users,
        "total_transactions": total_transactions,
        "total_pending_queue": total_pending,
    }



#  USER MANAGEMENT

@router.get("/users")
def list_all_users(session: SessionDep, _: User = Depends(require_admin)):
    """Lists all registered users in the platform."""
    users = session.exec(select(User).order_by(User.id.asc())).all()

    return [
        {
            "id": u.id,
            "email": u.email,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "is_verified": u.is_verified,
            "telegram_id": u.telegram_id,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(user_id: int, session: SessionDep, current_admin: User = Depends(require_admin)):

    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Superadmin cannot deactivate their own account."
        )

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    session.add(user)
    session.commit()
    session.refresh(user)

    return {"message": f"User {user.email} active status changed to {user.is_active}", "is_active": user.is_active}