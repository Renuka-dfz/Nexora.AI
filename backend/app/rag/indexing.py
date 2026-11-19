
"""Incremental RAG indexing for Nexora.AI.

Indexes verified company intelligence in PostgreSQL
using semantic chunking and local embeddings.

The caller owns the SQLAlchemy transaction.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    DimCompany,
    DimSource,
    FactCompanyIntelligence,
)
from app.rag.models import (
    RagDocumentChunk,
)
from app.rag.chunking import (
    semantic_chunk_section,
)
from app.rag.embeddings import (
    EMBEDDING_MODEL,
    embed_documents,
)


logger = logging.getLogger(__name__)

# Verify these values against your application's
# actual verification_status enum/allowed values.
TRUSTED_STATUSES = frozenset(
    {"verified", "approved"}
)


@dataclass(frozen=True)
class IndexingResult:
    intelligence_id: Any
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    deactivated: int = 0
    status: str = "completed"


def format_embedding_input(
    *,
    title: str,
    heading_path: str,
    content: str,
) -> str:
    """Format chunk text with heading and title context for higher semantic retrieval accuracy."""
    context_parts: list[str] = []
    if heading_path and heading_path.strip():
        context_parts.append(heading_path.strip())
    elif title and title.strip():
        context_parts.append(title.strip())

    clean_content = content.strip()
    if context_parts:
        return f"{' > '.join(context_parts)}\n{clean_content}"
    return clean_content


def _sha256(value: str) -> str:
    return hashlib.sha256(
        value.encode("utf-8")
    ).hexdigest()


def _load_existing_chunks(
    db: Session,
    intelligence_id: Any,
) -> dict[int, RagDocumentChunk]:
    """Load chunks for this fact and embedding model."""

    rows = db.scalars(
        select(RagDocumentChunk)
        .where(
            RagDocumentChunk.intelligence_id
            == intelligence_id,
            RagDocumentChunk.embedding_model
            == EMBEDDING_MODEL,
        )
        .with_for_update()
    ).all()

    return {
        row.chunk_index: row
        for row in rows
    }


def _deactivate_chunks(
    chunks: dict[int, RagDocumentChunk],
    *,
    now: datetime,
) -> int:
    count = 0

    for row in chunks.values():
        if row.is_active:
            row.is_active = False
            row.updated_at = now
            count += 1

    return count


def index_company_fact(
    *,
    db: Session,
    intelligence_id: Any,
    company_id: Any,
) -> IndexingResult:
    """
    Index one company intelligence record.

    Security:
        company_id must come from an authenticated
        backend context, never from model-generated text.

    The caller must commit on success or roll back
    on failure.
    """

    now = datetime.now(timezone.utc)

    # Lock the source fact so simultaneous indexing
    # operations cannot silently overwrite each other.
    fact = db.get(
        FactCompanyIntelligence,
        intelligence_id,
        with_for_update=True,
    )

    if fact is None:
        raise ValueError(
            "Company intelligence record not found."
        )

    if fact.company_id != company_id:
        raise PermissionError(
            "The intelligence record belongs "
            "to another company."
        )

    existing = _load_existing_chunks(
        db,
        intelligence_id,
    )

    verification_status = str(
        fact.verification_status or ""
    ).casefold()

    # Fail closed: unverified/stale facts must not
    # remain available in the trusted retrieval index.
    if (
        not fact.is_current
        or verification_status not in TRUSTED_STATUSES
    ):
        deactivated = _deactivate_chunks(
            existing,
            now=now,
        )
        db.flush()

        return IndexingResult(
            intelligence_id=intelligence_id,
            deactivated=deactivated,
            status="not_eligible",
        )

    source = db.get(
        DimSource,
        fact.source_id,
    )

    if (
        source is None
        or source.company_id != company_id
        or not source.source_url
    ):
        deactivated = _deactivate_chunks(
            existing,
            now=now,
        )
        db.flush()

        return IndexingResult(
            intelligence_id=intelligence_id,
            deactivated=deactivated,
            status="source_unavailable",
        )

    content = (fact.description or "").strip()

    if not content:
        deactivated = _deactivate_chunks(
            existing,
            now=now,
        )
        db.flush()

        return IndexingResult(
            intelligence_id=intelligence_id,
            deactivated=deactivated,
            status="empty_content",
        )

    heading_path = (
        fact.heading_path
        or fact.title
        or "Company Knowledge"
    )

    # This hash records the input used to create
    # the current semantic chunks.
    source_content_hash = _sha256(content)

    chunks = semantic_chunk_section(
        content=content,
        heading_path=heading_path,
        source_url=source.source_url,
    )

    if not chunks:
        raise ValueError(
            "Nonempty source produced no semantic chunks."
        )

    # Identify chunks that actually need new embeddings.
    changed_chunks = []

    for chunk in chunks:
        existing_row = existing.get(
            chunk.chunk_index
        )

        if (
            existing_row is None
            or existing_row.content_hash
            != chunk.content_hash
            or existing_row.content != chunk.content
        ):
            changed_chunks.append(chunk)

    # Construct embedding input enriched with heading context
    embedding_inputs = [
        format_embedding_input(
            title=fact.title or "",
            heading_path=chunk.heading_path or "",
            content=chunk.content,
        )
        for chunk in changed_chunks
    ]

    generated_vectors = embed_documents(embedding_inputs)

    vector_by_index = {
        chunk.chunk_index: vector
        for chunk, vector in zip(
            changed_chunks,
            generated_vectors,
            strict=True,
        )
    }

    created = 0
    updated = 0
    unchanged = 0

    current_indices = set()

    for chunk in chunks:
        index = chunk.chunk_index
        current_indices.add(index)

        existing_row = existing.get(index)

        if existing_row is None:
            row = RagDocumentChunk(
                company_id=company_id,
                intelligence_id=intelligence_id,
                page_id=fact.page_id,
                source_id=fact.source_id,
                chunk_index=index,
                heading_path=chunk.heading_path,
                source_url=chunk.source_url,
                content=chunk.content,
                content_hash=chunk.content_hash,
                source_content_hash=source_content_hash,
                token_count=chunk.token_count,
                embedding_model=EMBEDDING_MODEL,
                embedding=vector_by_index[index],
                is_active=True,
                created_at=now,
                updated_at=now,
            )

            db.add(row)
            created += 1
            continue

        content_changed = (
            existing_row.content_hash
            != chunk.content_hash
            or existing_row.content != chunk.content
        )

        metadata_changed = (
            existing_row.heading_path
            != chunk.heading_path
            or existing_row.source_url
            != chunk.source_url
            or existing_row.source_content_hash
            != source_content_hash
            or existing_row.token_count
            != chunk.token_count
            or not existing_row.is_active
            or existing_row.page_id != fact.page_id
            or existing_row.source_id != fact.source_id
        )

        if content_changed:
            existing_row.content = chunk.content
            existing_row.content_hash = (
                chunk.content_hash
            )
            existing_row.embedding = (
                vector_by_index[index]
            )

        if content_changed or metadata_changed:
            existing_row.heading_path = (
                chunk.heading_path
            )
            existing_row.source_url = (
                chunk.source_url
            )
            existing_row.source_content_hash = (
                source_content_hash
            )
            existing_row.token_count = (
                chunk.token_count
            )
            existing_row.page_id = fact.page_id
            existing_row.source_id = fact.source_id
            existing_row.is_active = True
            existing_row.updated_at = now

            updated += 1
        else:
            unchanged += 1

    # Only deactivate obsolete chunks after all
    # replacement embeddings have been generated.
    deactivated = 0

    for index, row in existing.items():
        if index not in current_indices and row.is_active:
            row.is_active = False
            row.updated_at = now
            deactivated += 1

    db.flush()

    logger.info(
        "RAG indexing completed: created=%d "
        "updated=%d unchanged=%d deactivated=%d",
        created,
        updated,
        unchanged,
        deactivated,
        extra={
            "company_id": str(company_id),
            "intelligence_id": str(intelligence_id),
        },
    )

    return IndexingResult(
        intelligence_id=intelligence_id,
        created=created,
        updated=updated,
        unchanged=unchanged,
        deactivated=deactivated,
    )


def index_company_knowledge(
    db: Session,
    *,
    company_id: Any,
    batch_size: int = 50,
) -> dict[str, Any]:
    """
    Idempotently index eligible Company Intelligence records for a company into PostgreSQL pgvector.

    Eligibility policy:
    - Company exists and matches company_id
    - Fact is current (is_current = True)
    - Fact has approved verification status (verification_status IN ('verified', 'approved'))
    - Fact has a valid source record
    - Fact has nonempty description

    Returns structured progress and storage telemetry.
    If no facts meet eligibility, returns status="no_eligible_facts" with 0 insertions.
    """
    if batch_size < 1:
        raise ValueError("batch_size must be >= 1")

    company = db.get(DimCompany, company_id)
    if company is None:
        raise ValueError(f"Company {company_id} does not exist.")

    # 1. Query all eligible company intelligence facts
    eligible_stmt = (
        select(FactCompanyIntelligence)
        .where(
            FactCompanyIntelligence.company_id == company_id,
            FactCompanyIntelligence.is_current.is_(True),
            FactCompanyIntelligence.verification_status.in_(TRUSTED_STATUSES),
        )
        .order_by(FactCompanyIntelligence.fact_id.asc())
    )
    eligible_facts = db.scalars(eligible_stmt).all()

    if not eligible_facts:
        logger.info(
            "No eligible facts found for company %s (status: no_eligible_facts)",
            company_id,
        )
        return {
            "status": "no_eligible_facts",
            "company_id": str(company_id),
            "eligible_facts": 0,
            "facts_processed": 0,
            "chunks_created": 0,
            "chunks_updated": 0,
            "chunks_unchanged": 0,
            "chunks_deactivated": 0,
        }

    total_eligible = len(eligible_facts)
    total_created = 0
    total_updated = 0
    total_unchanged = 0
    total_deactivated = 0
    total_processed = 0

    logger.info(
        "Starting RAG indexing for company %s: %d eligible facts in batches of %d",
        company_id,
        total_eligible,
        batch_size,
    )

    # 2. Process in transactional batches
    for batch_start in range(0, total_eligible, batch_size):
        batch = eligible_facts[batch_start : batch_start + batch_size]

        for fact in batch:
            try:
                res = index_company_fact(
                    db=db,
                    intelligence_id=fact.fact_id,
                    company_id=company_id,
                )
                total_created += res.created
                total_updated += res.updated
                total_unchanged += res.unchanged
                total_deactivated += res.deactivated
                total_processed += 1
            except Exception as exc:
                logger.error(
                    "Failed to index fact %s for company %s: %s",
                    fact.fact_id,
                    company_id,
                    exc,
                )
                continue

        db.commit()
        logger.info(
            "Progress for company %s: processed %d/%d facts (created=%d, updated=%d, unchanged=%d)",
            company_id,
            min(batch_start + len(batch), total_eligible),
            total_eligible,
            total_created,
            total_updated,
            total_unchanged,
        )

    # 3. Clean up active chunks belonging to obsolete or unverified facts for this company
    stale_chunks_stmt = (
        select(RagDocumentChunk)
        .join(
            FactCompanyIntelligence,
            FactCompanyIntelligence.fact_id == RagDocumentChunk.intelligence_id,
        )
        .where(
            RagDocumentChunk.company_id == company_id,
            RagDocumentChunk.is_active.is_(True),
            (
                FactCompanyIntelligence.is_current.is_(False)
                | ~FactCompanyIntelligence.verification_status.in_(TRUSTED_STATUSES)
            ),
        )
    )
    stale_chunks = db.scalars(stale_chunks_stmt).all()
    if stale_chunks:
        now = datetime.now(timezone.utc)
        for chunk in stale_chunks:
            chunk.is_active = False
            chunk.updated_at = now
            total_deactivated += 1
        db.commit()

    return {
        "status": "completed",
        "company_id": str(company_id),
        "eligible_facts": total_eligible,
        "facts_processed": total_processed,
        "chunks_created": total_created,
        "chunks_updated": total_updated,
        "chunks_unchanged": total_unchanged,
        "chunks_deactivated": total_deactivated,
    }


if __name__ == "__main__":
    import argparse
    from uuid import UUID
    from app.core.database import SessionLocal

    parser = argparse.ArgumentParser(
        description="Index eligible company knowledge into PostgreSQL pgvector."
    )
    parser.add_argument(
        "--company-id",
        required=True,
        type=UUID,
        help="UUID of the company to index",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Batch size for transactional chunk commits (default: 50)",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    print(f"Connecting to database to index company: {args.company_id}...")

    with SessionLocal() as session:
        result = index_company_knowledge(
            session,
            company_id=args.company_id,
            batch_size=args.batch_size,
        )
        print("\nRAG INDEXING RESULTS:")
        for key, value in result.items():
            print(f"  {key}: {value}")
