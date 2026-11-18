
"""Database-backed source integrity checks for Nexora.AI RAG.

Confirms:
- Company isolation
- Active RAG chunk
- Current company intelligence
- Approved verification status
- Matching source and page identity
- Matching chunk content hash
- Matching original source-content hash

Does not independently establish website truth.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    CrawledPage,
    DimSource,
    FactCompanyIntelligence,
)
from app.rag.models import (
    RagDocumentChunk,
)


TRUSTED_STATUSES = frozenset({
    "verified",
    "approved",
})


@dataclass(frozen=True)
class SourceCheck:
    chunk_id: Any
    eligible: bool
    reasons: tuple[str, ...]
    source_url: str | None = None


def _hash(text: str) -> str:
    return hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()


def _valid_source_url(url: str | None) -> bool:
    if not url:
        return False

    try:
        parsed = urlsplit(url)
        return (
            parsed.scheme in {"http", "https"}
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
        )
    except ValueError:
        return False


def verify_stored_chunk(
    *,
    db: Session,
    chunk_id: Any,
    company_id: Any,
) -> SourceCheck:
    """Recheck a retrieved chunk against its DB references."""

    statement = (
        select(
            RagDocumentChunk,
            FactCompanyIntelligence,
            DimSource,
            CrawledPage,
        )
        .join(
            FactCompanyIntelligence,
            RagDocumentChunk.intelligence_id
            == FactCompanyIntelligence.intelligence_id,
        )
        .join(
            DimSource,
            RagDocumentChunk.source_id
            == DimSource.source_id,
        )
        .join(
            CrawledPage,
            RagDocumentChunk.page_id
            == CrawledPage.page_id,
        )
        .where(
            RagDocumentChunk.chunk_id == chunk_id,
            RagDocumentChunk.company_id == company_id,
            FactCompanyIntelligence.company_id
            == company_id,
            DimSource.company_id == company_id,
            CrawledPage.company_id == company_id,
        )
    )

    row = db.execute(statement).one_or_none()

    if row is None:
        return SourceCheck(
            chunk_id=chunk_id,
            eligible=False,
            reasons=("not_found_or_wrong_company",),
        )

    chunk, fact, source, page = row
    reasons: list[str] = []

    if not chunk.is_active:
        reasons.append("inactive_chunk")

    if not fact.is_current:
        reasons.append("outdated_fact")

    status = str(
        fact.verification_status or ""
    ).casefold()

    if status not in TRUSTED_STATUSES:
        reasons.append("unverified_fact")

    if page.crawl_status != "success":
        reasons.append("unsuccessful_source_page")

    if (
        page.source_id != source.source_id
        or fact.source_id != source.source_id
        or fact.page_id != page.page_id
    ):
        reasons.append("source_relationship_mismatch")

    if chunk.source_url != source.source_url:
        reasons.append("source_url_mismatch")

    if page.page_url != source.source_url:
        reasons.append("page_url_mismatch")

    if not _valid_source_url(source.source_url):
        reasons.append("invalid_source_url")

    if _hash(chunk.content) != chunk.content_hash:
        reasons.append("chunk_hash_mismatch")

    fact_content = (fact.description or "").strip()

    if (
        _hash(fact_content)
        != chunk.source_content_hash
    ):
        reasons.append("source_content_changed")

    if not fact_content:
        reasons.append("empty_source_content")

    return SourceCheck(
        chunk_id=chunk_id,
        eligible=not reasons,
        reasons=tuple(reasons),
        source_url=source.source_url,
    )


def verify_retrieved_sources(
    *,
    db: Session,
    company_id: Any,
    chunk_ids: list[Any],
) -> dict[Any, SourceCheck]:
    """Check unique chunk IDs, preserving their input order."""

    results: dict[Any, SourceCheck] = {}

    for chunk_id in dict.fromkeys(chunk_ids):
        results[chunk_id] = verify_stored_chunk(
            db=db,
            chunk_id=chunk_id,
            company_id=company_id,
        )

    return results
