
"""Company-isolated hybrid RAG retrieval for Nexora.AI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, literal, select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    DimSource,
    FactCompanyIntelligence,
)
from app.rag.models import (
    RagDocumentChunk,
)
from app.rag.embeddings import (
    EMBEDDING_MODEL,
    embed_query,
)


TRUSTED_STATUSES = frozenset(
    {"verified", "approved"}
)

RRF_K = 60


@dataclass(frozen=True)
class RetrievedEvidence:
    chunk_id: Any
    company_id: Any
    intelligence_id: Any
    source_id: Any
    page_id: Any
    source_url: str
    heading_path: str
    content: str
    chunk_index: int
    vector_distance: float | None
    vector_rank: int | None
    keyword_rank: int | None
    rrf_score: float


def _eligible_query(
    company_id: Any,
):
    """Shared trusted-evidence filter for all search methods."""

    return (
        select(RagDocumentChunk)
        .join(
            FactCompanyIntelligence,
            FactCompanyIntelligence.fact_id
            == RagDocumentChunk.intelligence_id,
        )
        .join(
            DimSource,
            DimSource.source_id
            == RagDocumentChunk.source_id,
        )
        .where(
            RagDocumentChunk.company_id == company_id,
            FactCompanyIntelligence.company_id == company_id,
            DimSource.company_id == company_id,
            RagDocumentChunk.is_active.is_(True),
            FactCompanyIntelligence.is_current.is_(True),
            FactCompanyIntelligence.verification_status.in_(
                TRUSTED_STATUSES
            ),
            RagDocumentChunk.embedding_model
            == EMBEDDING_MODEL,
        )
    )


def _vector_search(
    db: Session,
    *,
    company_id: Any,
    query_vector: list[float],
    limit: int,
    max_distance: float | None,
) -> list[tuple[RagDocumentChunk, float]]:
    """Find nearest eligible vectors using cosine distance."""

    distance = (
        RagDocumentChunk.embedding.cosine_distance(
            query_vector
        )
    )

    statement = (
        _eligible_query(company_id)
        .add_columns(distance.label("distance"))
        .order_by(distance.asc())
        .limit(limit)
    )

    if max_distance is not None:
        statement = statement.where(
            distance <= max_distance
        )

    rows = db.execute(statement).all()

    return [
        (chunk, float(distance_value))
        for chunk, distance_value in rows
    ]


def _keyword_search(
    db: Session,
    *,
    company_id: Any,
    query: str,
    limit: int,
) -> list[RagDocumentChunk]:
    """PostgreSQL full-text search with relevance ranking."""

    document = func.to_tsvector(
        "english",
        func.concat(
            func.coalesce(
                RagDocumentChunk.heading_path,
                "",
            ),
            literal(" "),
            RagDocumentChunk.content,
        ),
    )

    search_query = func.websearch_to_tsquery(
        "english",
        query,
    )

    rank = func.ts_rank_cd(
        document,
        search_query,
    )

    statement = (
        _eligible_query(company_id)
        .where(
            document.bool_op("@@")(
                search_query
            )
        )
        .order_by(
            rank.desc(),
            RagDocumentChunk.chunk_id.asc(),
        )
        .limit(limit)
    )

    return list(
        db.scalars(statement).all()
    )


def semantic_retrieve(
    *,
    db: Session,
    company_id: Any,
    query: str,
    top_k: int = 5,
    max_vector_distance: float | None = None,
) -> list[RetrievedEvidence]:
    """
    Pure pgvector cosine-distance semantic retrieval against rag_document_chunk.

    - Generates normalized query vector using all-MiniLM-L6-v2 (384 dimensions).
    - Filters strictly by authorized company_id, is_active=True, is_current=True,
      and verification_status in ('verified', 'approved').
    - Returns top-k matching chunks ordered by ascending cosine distance.
    """
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Query cannot be empty.")

    if top_k < 1:
        raise ValueError("top_k must be positive.")

    if (
        max_vector_distance is not None
        and not 0 <= max_vector_distance <= 2
    ):
        raise ValueError(
            "Cosine distance must be between 0 and 2."
        )

    query = query.strip()
    query_vector = embed_query(query)

    vector_results = _vector_search(
        db,
        company_id=company_id,
        query_vector=query_vector,
        limit=top_k,
        max_distance=max_vector_distance,
    )

    results: list[RetrievedEvidence] = []
    for rank, (chunk, distance) in enumerate(vector_results, start=1):
        similarity_score = max(0.0, 1.0 - (distance / 2.0))
        results.append(
            RetrievedEvidence(
                chunk_id=chunk.chunk_id,
                company_id=chunk.company_id,
                intelligence_id=chunk.intelligence_id,
                source_id=chunk.source_id,
                page_id=chunk.page_id,
                source_url=chunk.source_url,
                heading_path=chunk.heading_path,
                content=chunk.content,
                chunk_index=chunk.chunk_index,
                vector_distance=distance,
                vector_rank=rank,
                keyword_rank=None,
                rrf_score=similarity_score,
            )
        )

    return results


def hybrid_retrieve(
    *,
    db: Session,
    company_id: Any,
    query: str,
    top_k: int = 5,
    candidate_k: int = 20,
    rrf_k: int = RRF_K,
    max_vector_distance: float | None = None,
) -> list[RetrievedEvidence]:
    """
    Combine vector and keyword retrieval using RRF.

    company_id must come from trusted authorization
    context, not an LLM or unvalidated client input.

    max_vector_distance is optional and must be
    calibrated on an evaluation dataset.
    """

    if not isinstance(query, str) or not query.strip():
        raise ValueError("Query cannot be empty.")

    if top_k < 1:
        raise ValueError("top_k must be positive.")

    if candidate_k < top_k:
        raise ValueError(
            "candidate_k must be >= top_k."
        )

    if rrf_k < 1:
        raise ValueError("rrf_k must be positive.")

    if (
        max_vector_distance is not None
        and not 0 <= max_vector_distance <= 2
    ):
        raise ValueError(
            "Cosine distance must be between 0 and 2."
        )

    query = query.strip()

    # Generate one normalized query embedding.
    query_vector = embed_query(query)

    vector_results = _vector_search(
        db,
        company_id=company_id,
        query_vector=query_vector,
        limit=candidate_k,
        max_distance=max_vector_distance,
    )

    keyword_results = _keyword_search(
        db,
        company_id=company_id,
        query=query,
        limit=candidate_k,
    )

    # Build a union of candidates.
    candidates: dict[Any, RagDocumentChunk] = {}
    scores: dict[Any, float] = {}
    vector_ranks: dict[Any, int] = {}
    keyword_ranks: dict[Any, int] = {}
    vector_distances: dict[Any, float] = {}

    for rank, (chunk, distance) in enumerate(
        vector_results,
        start=1,
    ):
        chunk_id = chunk.chunk_id

        candidates[chunk_id] = chunk
        vector_ranks[chunk_id] = rank
        vector_distances[chunk_id] = distance

        scores[chunk_id] = (
            scores.get(chunk_id, 0.0)
            + 1.0 / (rrf_k + rank)
        )

    for rank, chunk in enumerate(
        keyword_results,
        start=1,
    ):
        chunk_id = chunk.chunk_id

        candidates[chunk_id] = chunk
        keyword_ranks[chunk_id] = rank

        scores[chunk_id] = (
            scores.get(chunk_id, 0.0)
            + 1.0 / (rrf_k + rank)
        )

    ordered_ids = sorted(
        candidates,
        key=lambda chunk_id: (
            -scores[chunk_id],
            str(chunk_id),
        ),
    )[:top_k]

    results: list[RetrievedEvidence] = []

    for chunk_id in ordered_ids:
        chunk = candidates[chunk_id]

        results.append(
            RetrievedEvidence(
                chunk_id=chunk.chunk_id,
                company_id=chunk.company_id,
                intelligence_id=chunk.intelligence_id,
                source_id=chunk.source_id,
                page_id=chunk.page_id,
                source_url=chunk.source_url,
                heading_path=chunk.heading_path,
                content=chunk.content,
                chunk_index=chunk.chunk_index,
                vector_distance=vector_distances.get(
                    chunk_id
                ),
                vector_rank=vector_ranks.get(
                    chunk_id
                ),
                keyword_rank=keyword_ranks.get(
                    chunk_id
                ),
                rrf_score=scores[chunk_id],
            )
        )

    return results
