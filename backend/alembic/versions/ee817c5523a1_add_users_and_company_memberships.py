"""Add user identity and company membership tables."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ee817c5523a1"
down_revision: Union[str, Sequence[str], None] = "a4f6c2d819b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "app_user",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "company_membership",
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), server_default=sa.text("'owner'"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["dim_company.company_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("company_id", "user_id"),
    )


def downgrade() -> None:
    op.drop_table("company_membership")
    op.drop_table("app_user")
