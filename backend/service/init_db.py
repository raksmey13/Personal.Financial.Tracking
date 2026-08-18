import os
import logging
from datetime import date
from sqlmodel import Session, select
from database import engine
from models import User, UserProfile, Category
import bcrypt

logger = logging.getLogger("pftrack")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# Read credentials safely from environment variables
SUPERADMIN_EMAIL = os.getenv("SUPERADMIN_EMAIL", "admin@pftrack.com")
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "AdminSecurePassword123!")


def hash_password(password: str) -> str:
    """Hashes password using native bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def init_superadmin_and_defaults():
    """
    Ensures the Superadmin account exists and holds proper privileges on startup.
    Creates the account if missing, or upgrades/verifies/resets password if it already exists.
    """
    with Session(engine) as session:
        # 1. Look up existing superadmin dynamically by email
        admin = session.exec(
            select(User).where(User.email == SUPERADMIN_EMAIL)
        ).first()

        if not admin:
            # Create fresh superadmin account
            hashed_pw = hash_password(SUPERADMIN_PASSWORD)
            admin = User(
                email=SUPERADMIN_EMAIL,
                hashed_password=hashed_pw,
                is_active=True,
                is_admin=True,
                is_verified=True,
                created_at=date.today()
            )
            session.add(admin)
            session.flush()

            profile = UserProfile(
                first_name="System",
                last_name="Superadmin",
                user_id=admin.id
            )
            session.add(profile)
            session.commit()
            session.refresh(admin)
            logger.info(f"👑 [Superadmin Initialized] Account created for {SUPERADMIN_EMAIL} (ID: {admin.id})")
        else:
            # 🟢 IDEMPOTENT HEALING: Guarantee matching password hash & admin flags
            admin.hashed_password = hash_password(SUPERADMIN_PASSWORD)
            admin.is_admin = True
            admin.is_verified = True
            admin.is_active = True

            session.add(admin)
            session.commit()
            session.refresh(admin)
            logger.info(f"👑 [Superadmin Credentials & Flags Synced] Updated account for {SUPERADMIN_EMAIL}")

        # 2. Seed system infrastructure categories bound to admin user
        system_categories = [
            {"name": "Opening Balance", "type": "income", "icon": "wallet"},
            {"name": "Credit Card Payment", "type": "transfer", "icon": "credit-card"},
            {"name": "Loan Repayment", "type": "transfer", "icon": "bank"},
            {"name": "Loan Principal Top-Up", "type": "expense", "icon": "trending-up"},
            {"name": "Sweep Saving", "type": "income", "icon": "piggy-bank"},
            {"name": "Food & Dining", "type": "expense", "icon": "utensils"},
            {"name": "General Expense", "type": "expense", "icon": "receipt"},
            {"name": "Salary", "type": "income", "icon": "briefcase"},
            {"name": "Transport", "type": "expense", "icon": "car"},
            {"name": "Shopping", "type": "expense", "icon": "shopping-bag"},
            {"name": "Entertainment", "type": "expense", "icon": "film"},
            {"name": "Bills & Utilities", "type": "expense", "icon": "bolt"},
        ]

        for item in system_categories:
            existing = session.exec(
                select(Category).where(
                    Category.name == item["name"],
                    Category.type == item["type"],
                    Category.user_id == admin.id
                )
            ).first()

            if not existing:
                cat = Category(
                    name=item["name"],
                    type=item["type"],
                    icon=item["icon"],
                    is_active=True,
                    user_id=admin.id
                )
                session.add(cat)

        session.commit()
        logger.info("🏁 System infrastructure categories verified.")