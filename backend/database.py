from sqlmodel import create_engine, Session, SQLModel
from typing import Annotated
from fastapi import Depends

DATABASE_URL = "postgresql://postgres:1399@localhost:5432/FinanceDB"


engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True
)

def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)