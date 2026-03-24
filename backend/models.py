from datetime import date
from typing import List, Optional
from decimal import Decimal
from sqlmodel import Field, Relationship, SQLModel


class UserSettings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    language: str = Field(default="en")
    currency: str = Field(default="USD")
    dark_mode: bool = Field(default=False)


class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    icon_identifier: Optional[str] = Field(default="tag")

    # Relationships
    transactions: List["Transaction"] = Relationship(back_populates="category")
    budgets: List["Budget"] = Relationship(back_populates="category")


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    account_name: str = Field(unique=True)
    account_type: str
    balance: Decimal = Field(default=0, max_digits=12, decimal_places=2)
    is_active: bool = Field(default=True)

    # Relationships
    transactions: List["Transaction"] = Relationship(back_populates="account")


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: Decimal = Field(max_digits=12, decimal_places=2)
    description: str
    transaction_date: date = Field(default_factory=date.today, index=True)
    type: str  # "income" or "expense"

    # Foreign Keys
    category_id: int = Field(foreign_key="category.id")
    account_id: int = Field(foreign_key="account.id")

    # Relationships
    category: Optional[Category] = Relationship(back_populates="transactions")
    account: Optional[Account] = Relationship(back_populates="transactions")


# ADDED: Budget Model to match your ERD exactly
class Budget(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="category.id")
    monthly_limit: Decimal = Field(max_digits=12, decimal_places=2)
    start_date: date
    end_date: date

    # Relationships
    category: Optional[Category] = Relationship(back_populates="budgets")