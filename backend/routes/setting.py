import csv
import io
from fastapi import APIRouter, Response
from sqlmodel import select, func
from database import SessionDep
from models import UserSettings, Transaction

router = APIRouter(tags=["Settings & Analytics"])

@router.get("/settings/", response_model=UserSettings)
def get_settings(session: SessionDep):
    settings = session.exec(select(UserSettings)).first()
    if not settings:
        settings = UserSettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings

@router.patch("/settings/", response_model=UserSettings)
def update_settings(new_settings: UserSettings, session: SessionDep):
    db_settings = session.exec(select(UserSettings)).first() or UserSettings()
    db_settings.language = new_settings.language
    db_settings.currency = new_settings.currency
    db_settings.dark_mode = new_settings.dark_mode
    session.add(db_settings)
    session.commit()
    session.refresh(db_settings)
    return db_settings

@router.get("/export/csv")
def export_transactions_csv(session: SessionDep):
    transactions = session.exec(select(Transaction)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Type", "Amount", "Description", "Category ID"])
    for tx in transactions:
        writer.writerow([tx.id, tx.transaction_date, tx.type, tx.amount, tx.description, tx.category_id])
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=transactions_export.csv"})

@router.get("/analytics/summary")
def get_summary(session: SessionDep):
    total_income = session.exec(select(func.sum(Transaction.amount)).where(Transaction.type == "income")).first() or 0
    total_expense = session.exec(select(func.sum(Transaction.amount)).where(Transaction.type == "expense")).first() or 0
    return {"total_income": total_income, "total_expense": total_expense, "net_balance": total_income - total_expense}