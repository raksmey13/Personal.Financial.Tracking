from sqlmodel import text
from database import engine

print("⚙️ Manually forcing category table structural layout changes...")

with engine.connect() as connection:
    # 1. Physically append parent_id to your live table if it doesn't exist
    connection.execute(text("ALTER TABLE public.category ADD COLUMN IF NOT EXISTS parent_id INTEGER DEFAULT NULL;"))

    # 2. Add the foreign key constraint link manually with a clear system name
    connection.execute(text("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fk_category_parent') THEN
                ALTER TABLE public.category ADD CONSTRAINT fk_category_parent FOREIGN KEY (parent_id) REFERENCES public.category(id);
            END IF;
        END $$;
    """))

    connection.commit()

print("✅ Structural synchronization complete! Check your database table now.")