"""fix_telegram_id_mapping

Revision ID: <your_revision_id>
Revises: <previous_revision_id>
Create Date: 2026-08-13 03:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '<your_revision_id>'
down_revision = '<previous_revision_id>'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Clear telegram_id from user ID 1
    op.execute('UPDATE "user" SET telegram_id = NULL WHERE id = 1;')

    # Assign telegram_id to user ID 13
    op.execute('UPDATE "user" SET telegram_id = 5143452981 WHERE id = 13;')


def downgrade() -> None:
    # Optional rollback logic if needed
    op.execute('UPDATE "user" SET telegram_id = NULL WHERE id = 13;')
