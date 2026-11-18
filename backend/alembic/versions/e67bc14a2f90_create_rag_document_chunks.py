"""Create persistent RAG document chunks.

Revision ID: e67bc14a2f90
Revises: d4e5f6a7b8c9
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import VECTOR


revision: str = "e67bc14a2f90"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $pgvector_preflight$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_available_extensions
                WHERE name = 'vector'
            ) THEN
                RAISE EXCEPTION
                    'The PostgreSQL pgvector extension is not installed '
                    'on this server. Install a compatible pgvector build '
                    'and rerun the migration.';
            END IF;
        END;
        $pgvector_preflight$
        """
    )
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "rag_document_chunk",
        sa.Column("chunk_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("intelligence_id", sa.UUID(), nullable=False),
        sa.Column("page_id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("heading_path", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "source_content_hash",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column(
            "embedding_model",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column("embedding", VECTOR(384), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["dim_company.company_id"],
        ),
        sa.ForeignKeyConstraint(
            ["intelligence_id"],
            ["fact_company_intelligence.fact_id"],
        ),
        sa.ForeignKeyConstraint(
            ["page_id"],
            ["crawled_page.page_id"],
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["dim_source.source_id"],
        ),
        sa.PrimaryKeyConstraint("chunk_id"),
        sa.UniqueConstraint(
            "intelligence_id",
            "chunk_index",
            "embedding_model",
            name="uq_rag_fact_chunk_model",
        ),
    )
    op.create_index(
        "ix_rag_company_active",
        "rag_document_chunk",
        ["company_id", "is_active"],
    )
    op.create_index(
        "ix_rag_source",
        "rag_document_chunk",
        ["source_id"],
    )
    op.create_index(
        "ix_rag_intelligence",
        "rag_document_chunk",
        ["intelligence_id"],
    )


def downgrade() -> None:
    op.drop_table("rag_document_chunk")
