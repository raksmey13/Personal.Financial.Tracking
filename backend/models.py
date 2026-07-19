from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from sqlmodel import Field, Relationship, SQLModel


# ==========================================
# 1. SECURITY, PROFILE & SUBSCRIPTION SYSTEM
# ==========================================

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str  # Secure encryption string storage location
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)
    created_at: date = Field(default_factory=date.today)

    # Core relationship bindings
    profile: Optional["UserProfile"] = Relationship(back_populates="user")
    subscription: Optional["UserSubscription"] = Relationship(back_populates="user")
    accounts: List["Account"] = Relationship(back_populates="user")
    transactions: List["Transaction"] = Relationship(back_populates="user")
    budgets: List["Budget"] = Relationship(back_populates="user") # 🚀 Correctly points to Budget.user now
    ai_processing_logs: List["AIProcessingLog"] = Relationship(back_populates="user")


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None

    # 1:1 Identity anchor maps back explicitly to secure account gatekeeper
    user_id: int = Field(default=1, foreign_key="user.id", unique=True)
    user: Optional[User] = Relationship(back_populates="profile")


class UserSubscription(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    plan_name: str = Field(default="free")  # "free" or "premium"
    status: str = Field(default="active")  # "active", "canceled", "expired"
    current_period_end: date  # Validates access to premium AI processing tokens

    user_id: int = Field(default=1, foreign_key="user.id", unique=True)
    user: Optional[User] = Relationship(back_populates="subscription")


# ==========================================
# 2. DOUBLE-ENTRY ACCOUNTING LEDGER SYSTEM
# ==========================================

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    type: str  # "income", "expense", "transfer"
    icon: str
    is_active: bool = Field(default=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="category.id")

    # Relationships
    transactions: List["Transaction"] = Relationship(back_populates="category")
    budgets: List["Budget"] = Relationship(back_populates="category")
    subcategories: List["Category"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={"remote_side": "Category.id"}
    )
    parent: Optional["Category"] = Relationship(back_populates="subcategories")


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_name: str = Field(unique=True)
    account_type: str = Field(default="Normal")  # "Normal" | "Credit Card" | "Loan"
    balance: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    credit_limit: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    is_active: bool = Field(default=True)

    # 🟢 ADDED THIS FLAG HERE:
    is_savings_target: bool = Field(default=False)

    # Tracking properties to map perfectly with your database migrations
    payment_due_day: Optional[int] = Field(default=None, nullable=True)
    note: Optional[str] = Field(default=None, nullable=True)

    # Default fallback context to safeguard standalone local operations
    user_id: int = Field(default=1, foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="accounts")
    transactions: List["Transaction"] = Relationship(back_populates="account")


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    description: str
    transaction_date: date = Field(default_factory=date.today, index=True)
    type: str  # "income", "expense", "transfer"

    # Foreign Keys linking out cleanly
    category_id: int = Field(foreign_key="category.id")
    account_id: int = Field(foreign_key="account.id")
    user_id: int = Field(default=1, foreign_key="user.id", index=True)

    # Relationships
    category: Optional[Category] = Relationship(back_populates="transactions")
    account: Optional[Account] = Relationship(back_populates="transactions")
    user: Optional[User] = Relationship(back_populates="transactions")


# ==========================================
# 3. PLANNING, BUDGETS & AUTOMATION AUDITING
# ==========================================

class Budget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None)
    monthly_limit: Decimal = Field(default=0.0, max_digits=12, decimal_places=2)
    start_date: date
    end_date: date
    is_group_budget: bool = Field(default=False)
    is_rollover: bool = Field(default=False)
    category_ids_csv: Optional[str] = Field(default=None, nullable=True)

    # STRATEGY TYPE INTEGRATION: Keeps track of spending caps vs fixed reminders natively
    # "spending_cap" | "fixed_allocation" | "50_30_20"
    strategy_type: str = Field(default="spending_cap")

    # 🟢 ADDED: Tracking fields for custom allocation allocations (e.g., 50/30/20, 60/20/20, etc.)
    needs_percentage: Optional[int] = Field(default=50, nullable=True)
    wants_percentage: Optional[int] = Field(default=30, nullable=True)
    savings_percentage: Optional[int] = Field(default=20, nullable=True)

    category_id: Optional[int] = Field(default=None, foreign_key="category.id", nullable=True)
    user_id: int = Field(default=1, foreign_key="user.id", index=True)

    # Relationships mapped back cleanly
    category: Optional["Category"] = Relationship(back_populates="budgets")
    user: Optional["User"] = Relationship(back_populates="budgets") # 🚀


class AIProcessingLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    raw_input_text: str  # Holds the copy-pasted raw notification message blocks
    parsed_transactions_count: int = Field(default=0)  # Total transactions dynamically generated out of text logs
    tokens_used: int = Field(default=0)  # Performance efficiency metadata monitoring trace
    status: str = Field(default="success")  # "success" or "failed"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user_id: int = Field(default=1, foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="ai_processing_logs")


class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    # Notification Details
    title: str  # e.g., "Budget Exceeded!" or "Sweep Success"
    message: str  # e.g., "You have used 85% of your Dining Out budget."
    notification_type: str  # e.g., "warning", "info", "success"

    # State tracking
    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)