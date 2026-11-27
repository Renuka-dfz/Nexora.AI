"""add weekly content batches and scheduling

Revision ID: 2f7c8d9e0a1b
Revises: f14c2b9d6a80
Create Date: 2026-11-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2f7c8d9e0a1b"
down_revision: Union[str, Sequence[str], None] = "f14c2b9d6a80"
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if "dim_content_generation_batch" not in tables:
        op.create_table(
            "dim_content_generation_batch",
            sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("platform", sa.String(length=30), nullable=False),
            sa.Column("mode", sa.String(length=30), nullable=False),
            sa.Column("status", sa.String(length=30), server_default=sa.text("'queued'"), nullable=False),
            sa.Column("prompt", sa.Text(), nullable=True),
            sa.Column("total_requested", sa.Integer(), server_default=sa.text("5"), nullable=False),
            sa.Column("total_created", sa.Integer(), server_default=sa.text("0"), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
            sa.CheckConstraint("status IN ('queued', 'generating', 'completed', 'partial', 'failed')", name="ck_content_generation_batch_status"),
            sa.CheckConstraint("platform IN ('linkedin', 'instagram')", name="ck_content_generation_batch_platform"),
            sa.ForeignKeyConstraint(["company_id"], ["dim_company.company_id"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["user_id"], ["app_user.user_id"], ondelete="RESTRICT"),
            sa.PrimaryKeyConstraint("batch_id"),
        )
        op.create_index("ix_dim_content_generation_batch_company_id", "dim_content_generation_batch", ["company_id"], unique=False)
        op.create_index("ix_dim_content_generation_batch_user_id", "dim_content_generation_batch", ["user_id"], unique=False)

    existing_cols = [c["name"] for c in inspector.get_columns("dim_content")]
    
    col_defs = [
        ("generation_batch_id", sa.Column("generation_batch_id", postgresql.UUID(as_uuid=True), nullable=True)),
        ("image_url", sa.Column("image_url", sa.Text(), nullable=True)),
        ("caption", sa.Column("caption", sa.Text(), nullable=True)),
        ("hashtags", sa.Column("hashtags", sa.Text(), nullable=True)),
        ("scheduled_at", sa.Column("scheduled_at", sa.TIMESTAMP(timezone=True), nullable=True)),
        ("published_at", sa.Column("published_at", sa.TIMESTAMP(timezone=True), nullable=True)),
        ("published_post_id", sa.Column("published_post_id", sa.String(length=255), nullable=True)),
        ("publish_status", sa.Column("publish_status", sa.String(length=30), server_default=sa.text("'draft'"), nullable=False)),
        ("publish_error", sa.Column("publish_error", sa.Text(), nullable=True)),
    ]
    for col_name, col_obj in col_defs:
        if col_name not in existing_cols:
            op.add_column("dim_content", col_obj)

    # Check foreign keys
    fks = [fk.get("name") for fk in inspector.get_foreign_keys("dim_content") if fk.get("name")]
    if "fk_dim_content_generation_batch" not in fks:
        op.create_foreign_key(
            "fk_dim_content_generation_batch",
            "dim_content",
            "dim_content_generation_batch",
            ["generation_batch_id"],
            ["batch_id"],
            ondelete="SET NULL",
        )

    # Check constraints
    check_constraints = [c.get("name") for c in inspector.get_check_constraints("dim_content") if c.get("name")]
    if "ck_marketing_content_publish_status" not in check_constraints:
        op.create_check_constraint(
            "ck_marketing_content_publish_status",
            "dim_content",
            "publish_status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')",
        )

    # Check indexes
    indexes = [ix.get("name") for ix in inspector.get_indexes("dim_content") if ix.get("name")]
    if "ix_dim_content_generation_batch_id" not in indexes:
        op.create_index("ix_dim_content_generation_batch_id", "dim_content", ["generation_batch_id"], unique=False)
    if "ix_dim_content_scheduled_at" not in indexes:
        op.create_index("ix_dim_content_scheduled_at", "dim_content", ["scheduled_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_dim_content_scheduled_at", table_name="dim_content")
    op.drop_index("ix_dim_content_generation_batch_id", table_name="dim_content")
    op.drop_constraint("ck_marketing_content_publish_status", "dim_content", type_="check")
    op.drop_constraint("fk_dim_content_generation_batch", "dim_content", type_="foreignkey")
    for name in ("publish_error", "published_post_id", "published_at", "scheduled_at", "hashtags", "caption", "image_url", "generation_batch_id"):
        op.drop_column("dim_content", name)
    op.drop_index("ix_dim_content_generation_batch_user_id", table_name="dim_content_generation_batch")
    op.drop_index("ix_dim_content_generation_batch_company_id", table_name="dim_content_generation_batch")
    op.drop_table("dim_content_generation_batch")
