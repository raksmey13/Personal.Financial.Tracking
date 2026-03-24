import csv
import io
from typing import List, Optional
from datetime import date
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import select, func

# Ensure database.py and models.py exist in the same folder
from database import engine, SessionDep, create_db_and_tables
from models import UserSettings, Category, Account, Transaction, Budget

@asynccontextmanager
async def lifespan(app: FastAPI):
    # This automatically creates the tables in PostgreSQL on startup
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan, title="Personal Finance Tracker API")

# --- 1. CORS SETTINGS (Crucial for your React Frontend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your React app (localhost:5173) to talk to this API
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to your Finance API. Visit /docs for the UI."}

# --- 2. TRANSACTION ROUTES ---

@app.post("/transactions/", response_model=Transaction)
def create_transaction(transaction: Transaction, session: SessionDep):
    db_account = session.get(Account, transaction.account_id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Automatically update the account balance
    if transaction.type == "income":
        db_account.balance += transaction.amount
    else:
        db_account.balance -= transaction.amount

    session.add(transaction)
    session.add(db_account)
    session.commit()
    session.refresh(transaction)
    return transaction

@app.get("/transactions/", response_model=List[Transaction])
def read_transactions(session: SessionDep, start_date: Optional[date] = None, end_date: Optional[date] = None):
    statement = select(Transaction)
    if start_date and end_date:
        statement = statement.where(Transaction.transaction_date >= start_date)
        statement = statement.where(Transaction.transaction_date <= end_date)
    return session.exec(statement).all()

@app.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: int, session: SessionDep):
    transaction = session.get(Transaction, transaction_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db_account = session.get(Account, transaction.account_id)
    if db_account:
        if transaction.type == "income":
            db_account.balance -= transaction.amount
        else:
            db_account.balance += transaction.amount
        session.add(db_account)

    session.delete(transaction)
    session.commit()
    return {"message": "Transaction deleted successfully"}

# --- 3. ACCOUNT & CATEGORY ROUTES (New) ---

@app.post("/accounts/", response_model=Account)
def create_account(account: Account, session: SessionDep):
    session.add(account)
    session.commit()
    session.refresh(account)
    return account

@app.get("/accounts/", response_model=List[Account])
def read_accounts(session: SessionDep):
    return session.exec(select(Account)).all()

@app.post("/categories/", response_model=Category)
def create_category(category: Category, session: SessionDep):
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

@app.get("/categories/", response_model=List[Category])
def read_categories(session: SessionDep):
    return session.exec(select(Category)).all()

# --- 4. SETTINGS ROUTES ---

@app.get("/settings/", response_model=UserSettings)
def get_settings(session: SessionDep):
    settings = session.exec(select(UserSettings)).first()
    if not settings:
        settings = UserSettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings

@app.patch("/settings/", response_model=UserSettings)
def update_settings(new_settings: UserSettings, session: SessionDep):
    db_settings = session.exec(select(UserSettings)).first()
    if not db_settings:
        db_settings = UserSettings()

    db_settings.language = new_settings.language # Fixed the typo here
    db_settings.currency = new_settings.currency
    db_settings.dark_mode = new_settings.dark_mode

    session.add(db_settings)
    session.commit()
    session.refresh(db_settings)
    return db_settings

# --- 5. ANALYTICS & EXPORT ---

@app.get("/export/csv")
def export_transactions_csv(session: SessionDep):
    transactions = session.exec(select(Transaction)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Type", "Amount", "Description", "Category ID"])

    for tx in transactions:
        writer.writerow([tx.id, tx.transaction_date, tx.type, tx.amount, tx.description, tx.category_id])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions_export.csv"}
    )

@app.get("/analytics/summary")
def get_summary(session: SessionDep):
    income_stmt = select(func.sum(Transaction.amount)).where(Transaction.type == "income")
    expense_stmt = select(func.sum(Transaction.amount)).where(Transaction.type == "expense")

    total_income = session.exec(income_stmt).first() or 0
    total_expense = session.exec(expense_stmt).first() or 0

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "net_balance": total_income - total_expense
    }