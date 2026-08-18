from sqlmodel import Session, text
from database import engine

print("🚀 Running custom database migration / cleanup...")

with Session(engine) as session:
    try:
        # 1. Reassign any orphaned records from user ID 1 to user ID 13
        tables = [
            "transaction",
            "account",
            "category",
            "budget",
            "budget_strategy",  # <--- Added this table
            "notification",
            "pendingtransaction"
        ]

        for table in tables:
            try:
                session.exec(text(f'UPDATE "{table}" SET user_id = 13 WHERE user_id = 1;'))
                print(f"✅ Reassigned {table} records from user 1 to user 13")
            except Exception as e:
                print(f"⚠️ Skipped {table}: {e}")

        # 2. Force lock the telegram_id to user 13 and clear it from user 1
        session.exec(text('UPDATE "user" SET telegram_id = NULL WHERE id = 1;'))
        session.exec(text('UPDATE "user" SET telegram_id = 5143452981 WHERE id = 13;'))
        print("✅ Updated telegram_id mapping for user 13")

        # 3. Safely delete user ID 1 now that all foreign keys are cleared/moved
        session.exec(text('DELETE FROM "user" WHERE id = 1;'))
        print("🗑️ Successfully deleted ghost user ID 1!")

        session.commit()
        print("🎉 Migration completed successfully!")

    except Exception as e:
        session.rollback()
        print(f"❌ Migration failed: {e}")