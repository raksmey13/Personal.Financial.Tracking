from datetime import datetime, date
from typing import List, Optional
from decimal import Decimal
from sqlmodel import Field, Relationship, SQLModel
from sqlalchemy import Column, BigInteger, Integer, ForeignKey


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    is_admin: bool = Field(default=False)

    # Thesis Compliance Fields
    is_verified: bool = Field(default=True)
    verification_token: Optional[str] = Field(default=None, nullable=True)

    created_at: date = Field(default_factory=date.today)


    telegram_id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, unique=True, nullable=True)
    )
    telegram_linking_token: Optional[str] = Field(default=None, unique=True, nullable=True)

    # Core Relationship Bindings
    profile: Optional["UserProfile"] = Relationship(back_populates="user")
    accounts: List["Account"] = Relationship(back_populates="user")
    transactions: List["Transaction"] = Relationship(back_populates="user")
    budgets: List["Budget"] = Relationship(back_populates="user")
    categories: List["Category"] = Relationship(back_populates="user")
    budget_strategies: List["BudgetStrategy"] = Relationship(back_populates="user")
    ai_processing_logs: List["AIProcessingLog"] = Relationship(back_populates="user")

    # Automation System Bindings
    pending_transactions: List["PendingTransaction"] = Relationship(back_populates="user")
    beneficiary_category_maps: List["BeneficiaryCategoryMap"] = Relationship(back_populates="user")


class UserProfile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    first_name: Optional[str] = Field(default=None, nullable=True)
    last_name: Optional[str] = Field(default=None, nullable=True)
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None

    user_id: int = Field(foreign_key="user.id", unique=True)
    user: Optional[User] = Relationship(back_populates="profile")




class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    type: str
    icon: str
    is_active: bool = Field(default=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="category.id")

    user_id: int = Field(foreign_key="user.id", index=True)

    user: Optional["User"] = Relationship(back_populates="categories")
    transactions: List["Transaction"] = Relationship(back_populates="category")


    budget_links: List["BudgetCategoryLink"] = Relationship(
        back_populates="category",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    strategy_item_links: List["StrategyItemCategoryLink"] = Relationship(
        back_populates="category",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )

    subcategories: List["Category"] = Relationship(
        back_populates="parent",
        sa_relationship_kwargs={"remote_side": "Category.id"}
    )
    parent: Optional["Category"] = Relationship(back_populates="subcategories")
    beneficiary_category_maps: List["BeneficiaryCategoryMap"] = Relationship(back_populates="category")


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_name: str = Field(index=True)
    account_type: str = Field(default="Normal")
    balance: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    credit_limit: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    interest_rate: Optional[Decimal] = Field(default=0.0, max_digits=5, decimal_places=2, nullable=True)
    currency: str = Field(default="USD")
    is_active: bool = Field(default=True)

    is_savings_target: bool = Field(default=False)
    payment_due_day: Optional[int] = Field(default=None, nullable=True)
    note: Optional[str] = Field(default=None, nullable=True)

    user_id: int = Field(foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="accounts")
    transactions: List["Transaction"] = Relationship(
        back_populates="account",
        sa_relationship_kwargs={"primaryjoin": "Account.id==Transaction.account_id"}
    )
    pending_transactions: List["PendingTransaction"] = Relationship(back_populates="account")


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    description: str
    transaction_date: date = Field(default_factory=date.today, index=True)
    type: str

    category_id: int = Field(foreign_key="category.id")
    account_id: int = Field(foreign_key="account.id")
    to_account_id: Optional[int] = Field(default=None, foreign_key="account.id", nullable=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    category: Optional[Category] = Relationship(back_populates="transactions")
    account: Optional[Account] = Relationship(
        back_populates="transactions",
        sa_relationship_kwargs={"primaryjoin": "Transaction.account_id==Account.id"}
    )
    to_account: Optional[Account] = Relationship(
        sa_relationship_kwargs={"primaryjoin": "Transaction.to_account_id==Account.id"}
    )
    user: Optional[User] = Relationship(back_populates="transactions")


class PendingTransaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    raw_beneficiary_name: str
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    transaction_date: date = Field(default_factory=date.today)
    source: str = Field(default="telegram")
    status: str = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    account_id: int = Field(foreign_key="account.id")
    user_id: int = Field(foreign_key="user.id", index=True)

    user: Optional[User] = Relationship(back_populates="pending_transactions")
    account: Optional[Account] = Relationship(back_populates="pending_transactions")


class BeneficiaryCategoryMap(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    raw_name: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    category_id: int = Field(foreign_key="category.id")
    user_id: int = Field(foreign_key="user.id", index=True)

    user: Optional[User] = Relationship(back_populates="beneficiary_category_maps")
    category: Optional[Category] = Relationship(back_populates="beneficiary_category_maps")




class BudgetCategoryLink(SQLModel, table=True):
    __tablename__ = "budget_category_link"

    budget_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("budget.id", ondelete="CASCADE"), primary_key=True)
    )
    category_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("category.id", ondelete="CASCADE"), primary_key=True)
    )

    budget: Optional["Budget"] = Relationship(back_populates="category_links")
    category: Optional["Category"] = Relationship(back_populates="budget_links")


class StrategyItemCategoryLink(SQLModel, table=True):
    __tablename__ = "strategy_item_category_link"

    strategy_item_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("budget_strategy_item.id", ondelete="CASCADE"), primary_key=True)
    )
    category_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("category.id", ondelete="CASCADE"), primary_key=True)
    )

    strategy_item: Optional["BudgetStrategyItem"] = Relationship(back_populates="category_links")
    category: Optional["Category"] = Relationship(back_populates="strategy_item_links")


class Budget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str] = Field(default=None)
    monthly_limit: Decimal = Field(default=0.0, max_digits=12, decimal_places=2)
    currency: str = Field(default="USD")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    is_group_budget: bool = Field(default=False)
    is_rollover: bool = Field(default=False)

    strategy_type: str = Field(default="spending_cap")


    strategy_id: Optional[int] = Field(default=None, foreign_key="budget_strategy.id", nullable=True)
    strategy: Optional["BudgetStrategy"] = Relationship(back_populates="budgets")

    user_id: int = Field(foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="budgets")


    category_links: List[BudgetCategoryLink] = Relationship(
        back_populates="budget",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class BudgetStrategy(SQLModel, table=True):
    __tablename__ = "budget_strategy"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="budget_strategies")

    name: str = Field(default="Custom Allocation Strategy")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    items: List["BudgetStrategyItem"] = Relationship(
        back_populates="strategy",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


    budgets: List[Budget] = Relationship(back_populates="strategy")


class BudgetStrategyItem(SQLModel, table=True):
    __tablename__ = "budget_strategy_item"

    id: Optional[int] = Field(default=None, primary_key=True)
    strategy_id: int = Field(
        sa_column=Column(Integer, ForeignKey("budget_strategy.id", ondelete="CASCADE"), nullable=False, index=True)
    )

    bucket_name: str
    percentage: Decimal = Field(default=0.0, max_digits=5, decimal_places=2)

    strategy: Optional[BudgetStrategy] = Relationship(back_populates="items")


    category_links: List[StrategyItemCategoryLink] = Relationship(
        back_populates="strategy_item",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class AIProcessingLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    raw_input_text: str
    parsed_transactions_count: int = Field(default=0)
    tokens_used: int = Field(default=0)
    status: str = Field(default="success")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user_id: int = Field(foreign_key="user.id", index=True)
    user: Optional[User] = Relationship(back_populates="ai_processing_logs")


class Notification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)

    title: str
    message: str
    notification_type: str

    is_read: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    entity_type: Optional[str] = Field(default=None)
    entity_id: Optional[int] = Field(default=None)

    deduplication_key: Optional[str] = Field(default=None, unique=True, index=True)
    expires_at: Optional[datetime] = Field(default=None)


class UserSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)

    language: str = Field(default="en")
    first_day_of_month: int = Field(default=1)
    first_day_of_week: str = Field(default="Monday")
    transition_set_transaction: bool = Field(default=True)
    display_bank_check_icon: bool = Field(default=True)