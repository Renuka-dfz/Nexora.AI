
"""SQLAlchemy model for Nexora.AI RAG chunks."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import VECTOR

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RagDocumentChunk(Base):
    __tablename__ = "rag_document_chunk"

    __table_args__ = (
        UniqueConstraint(
            "intelligence_id",
            "chunk_index",
            "embedding_model",
            name="uq_rag_fact_chunk_model",
        ),
        Index(
            "ix_rag_company_active",
            "company_id",
            "is_active",
        ),
        Index(
            "ix_rag_source",
            "source_id",
        ),
        Index(
            "ix_rag_intelligence",
            "intelligence_id",
        ),
    )

    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dim_company.company_id"),
        nullable=False,
    )

    intelligence_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "fact_company_intelligence.fact_id"
        ),
        nullable=False,
    )

    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("crawled_page.page_id"),
        nullable=False,
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dim_source.source_id"),
        nullable=False,
    )

    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    heading_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
    )

    source_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    source_content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    token_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    embedding_model: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Matches all-MiniLM-L6-v2.
    embedding: Mapped[list[float]] = mapped_column(
        VECTOR(384),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )
