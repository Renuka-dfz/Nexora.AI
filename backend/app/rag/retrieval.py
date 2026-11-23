"""Company-isolated hybrid RAG retrieval with Cross-Encoder reranking for Nexora.AI."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Sequence

from sqlalchemy import func, literal, select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    DimCategory,
    DimCompany,
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

logger = logging.getLogger(__name__)

TRUSTED_STATUSES = frozenset({"verified", "approved"})

RRF_K = 60

# Conversational stop words removed during keyword query relaxation
CONVERSATIONAL_STOPWORDS = frozenset({
    "a", "about", "all", "an", "and", "any", "are", "as", "at", "be",
    "been", "can", "could", "describe", "did", "do", "does", "explain",
    "find", "for", "from", "get", "give", "had", "has", "have", "how",
    "i", "in", "is", "it", "its", "know", "like", "me", "more", "my",
    "of", "on", "or", "our", "out", "please", "provide", "show", "so",
    "some", "tell", "that", "the", "their", "them", "then", "there",
    "these", "they", "this", "to", "us", "was", "we", "were", "what",
    "when", "where", "which", "who", "whom", "will", "with", "would",
    "you", "your",
})


@dataclass(frozen=True)
class RetrievedEvidence:
    """Individual retrieved evidence chunk with separate distance, RRF, and rerank metrics."""
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
    category_name: str | None = None
    company_name: str | None = None
    rerank_score: float | None = None
    rerank_rank: int | None = None


def _eligible_query(
    company_id: Any,
):
    """
    Shared trusted-evidence filter for all search methods.
    
    Joins FactCompanyIntelligence, DimCategory, DimCompany, and DimSource to
    enforce company isolation, currency, and verification status while providing
    category and company metadata for downstream Cross-Encoder reranking.
    """
    return (
        select(
            RagDocumentChunk,
            DimCategory.category_name,
            DimCompany.company_name,
        )
        .join(
            FactCompanyIntelligence,
            FactCompanyIntelligence.fact_id
            == RagDocumentChunk.intelligence_id,
        )
        .join(
            DimCategory,
            DimCategory.category_id
            == FactCompanyIntelligence.category_id,
        )
        .join(
            DimCompany,
            DimCompany.company_id
            == RagDocumentChunk.company_id,
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
    max_distance: float | None = None,
    target_categories: Sequence[str] | None = None,
) -> list[tuple[RagDocumentChunk, str | None, str | None, float]]:
    """
    Find nearest eligible vectors using cosine distance.
    
    Returns tuples of (chunk, category_name, company_name, distance).
    If target_categories is specified, candidates from those categories are also
    included in the candidate pool without excluding relevant matches from other categories.
    """
    distance = (
        RagDocumentChunk.embedding.cosine_distance(
            query_vector
        )
    )

    base_statement = (
        _eligible_query(company_id)
        .add_columns(distance.label("distance"))
    )

    if max_distance is not None:
        base_statement = base_statement.where(
            distance <= max_distance
        )

    # Category-aware representation: ensure targeted categories have guaranteed candidates in the pool
    if target_categories:
        target_cat_set = [
            c.strip().casefold()
            for c in target_categories
            if c and c.strip()
        ]
    else:
        target_cat_set = []

    if target_cat_set:
        cat_quota = min(10, max(5, limit // 3))
        cat_statement = (
            base_statement.where(
                func.lower(DimCategory.category_name).in_(target_cat_set)
            )
            .order_by(distance.asc())
            .limit(cat_quota)
        )
        cat_rows = list(db.execute(cat_statement).all())
        seen_chunk_ids = {row[0].chunk_id for row in cat_rows}

        global_quota = limit - len(cat_rows)
        global_statement = base_statement.order_by(distance.asc()).limit(limit)
        global_rows = list(db.execute(global_statement).all())

        blended_rows = list(cat_rows)
        for row in global_rows:
            if row[0].chunk_id not in seen_chunk_ids:
                seen_chunk_ids.add(row[0].chunk_id)
                blended_rows.append(row)
                if len(blended_rows) >= limit:
                    break
    else:
        global_statement = base_statement.order_by(distance.asc()).limit(limit)
        blended_rows = list(db.execute(global_statement).all())

    return [
        (chunk, cat_name, comp_name, float(dist_val))
        for chunk, cat_name, comp_name, dist_val in blended_rows[:limit]
    ]


def _clean_keyword_query(query: str) -> list[str]:
    """Extract non-filler search tokens from conversational query string."""
    raw_tokens = re.findall(r"\b[A-Za-z0-9_-]{2,}\b", query)
    return [
        token for token in raw_tokens
        if token.casefold() not in CONVERSATIONAL_STOPWORDS
    ]


def _keyword_search(
    db: Session,
    *,
    company_id: Any,
    query: str,
    limit: int,
    target_categories: Sequence[str] | None = None,
) -> list[tuple[RagDocumentChunk, str | None, str | None]]:
    """
    PostgreSQL full-text search with natural-language relaxation.
    
    Prevents 0 matches on conversational questions by:
    1. Running standard websearch_to_tsquery.
    2. If fewer than limit matches are returned, extracting substantive tokens and
       running a disjunctive (OR) tsquery to retrieve candidates ranked by ts_rank_cd.
    """
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

    base_statement = _eligible_query(company_id)

    # 1. Primary strict search
    strict_search_query = func.websearch_to_tsquery(
        "english",
        query,
    )
    strict_rank = func.ts_rank_cd(
        document,
        strict_search_query,
    )

    strict_statement = (
        base_statement
        .where(document.bool_op("@@")(strict_search_query))
        .order_by(
            strict_rank.desc(),
            RagDocumentChunk.chunk_id.asc(),
        )
        .limit(limit)
    )

    rows = list(db.execute(strict_statement).all())

    # 2. Conversational fallback: if strict search yielded fewer than limit rows,
    # extract substantive keywords and perform disjunctive (OR) search.
    if len(rows) < limit:
        meaningful_words = _clean_keyword_query(query)
        if target_categories:
            for cat in target_categories:
                for word in re.findall(r"\b[A-Za-z0-9_-]{2,}\b", cat):
                    if (
                        word.casefold() not in CONVERSATIONAL_STOPWORDS
                        and word not in meaningful_words
                    ):
                        meaningful_words.append(word)

        if meaningful_words:
            # PostgreSQL websearch_to_tsquery interprets 'or' as disjunction (|)
            relaxed_query_str = " or ".join(meaningful_words)
            relaxed_search_query = func.websearch_to_tsquery(
                "english",
                relaxed_query_str,
            )
            relaxed_rank = func.ts_rank_cd(
                document,
                relaxed_search_query,
            )

            seen_ids = {row[0].chunk_id for row in rows}
            relaxed_statement = (
                base_statement
                .where(document.bool_op("@@")(relaxed_search_query))
                .order_by(
                    relaxed_rank.desc(),
                    RagDocumentChunk.chunk_id.asc(),
                )
                .limit(limit * 2)
            )
            relaxed_rows = db.execute(relaxed_statement).all()
            for r_row in relaxed_rows:
                if r_row[0].chunk_id not in seen_ids:
                    seen_ids.add(r_row[0].chunk_id)
                    rows.append(r_row)
                    if len(rows) >= limit:
                        break

    return [
        (chunk, cat_name, comp_name)
        for chunk, cat_name, comp_name in rows
    ]


def semantic_retrieve(
    *,
    db: Session,
    company_id: Any,
    query: str,
    top_k: int = 5,
    candidate_k: int = 25,
    max_vector_distance: float | None = None,
    target_categories: Sequence[str] | None = None,
    rerank: bool = True,
    min_rerank_score: float | None = None,
) -> list[RetrievedEvidence]:
    """
    pgvector cosine-distance semantic retrieval with Cross-Encoder reranking.

    - Generates normalized query vector using all-MiniLM-L6-v2 (384 dimensions).
    - Filters strictly by authorized company_id, is_active=True, is_current=True,
      and verification_status in ('verified', 'approved').
    - Retrieves candidate pool (up to candidate_k).
    - If rerank=True, applies Cross-Encoder reranker (ms-marco-MiniLM-L6-v2) enriched
      with company and category context, returning top_k items ordered by rerank_score.
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

    retrieve_limit = max(candidate_k, top_k * 4) if rerank else top_k

    vector_results = _vector_search(
        db,
        company_id=company_id,
        query_vector=query_vector,
        limit=min(retrieve_limit, 30),
        max_distance=max_vector_distance,
        target_categories=target_categories,
    )

    candidates: list[RetrievedEvidence] = []
    for rank, (chunk, cat_name, comp_name, distance) in enumerate(vector_results, start=1):
        similarity_score = max(0.0, 1.0 - (distance / 2.0))
        candidates.append(
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
                category_name=cat_name,
                company_name=comp_name,
            )
        )

    if not candidates:
        return []

    if not rerank:
        return candidates[:top_k]

    # Lazy import to avoid circular dependencies
    from app.rag.reranking import rerank_evidence

    ranked = rerank_evidence(
        query=query,
        candidates=candidates[:30],
        top_k=top_k,
        min_score=min_rerank_score,
    )

    results: list[RetrievedEvidence] = []
    for item in ranked:
        evidence = item.evidence
        results.append(
            RetrievedEvidence(
                chunk_id=evidence.chunk_id,
                company_id=evidence.company_id,
                intelligence_id=evidence.intelligence_id,
                source_id=evidence.source_id,
                page_id=evidence.page_id,
                source_url=evidence.source_url,
                heading_path=evidence.heading_path,
                content=evidence.content,
                chunk_index=evidence.chunk_index,
                vector_distance=evidence.vector_distance,
                vector_rank=evidence.vector_rank,
                keyword_rank=evidence.keyword_rank,
                rrf_score=evidence.rrf_score,
                category_name=evidence.category_name,
                company_name=evidence.company_name,
                rerank_score=item.rerank_score,
                rerank_rank=item.rerank_position,
            )
        )

    return results


def hybrid_retrieve(
    *,
    db: Session,
    company_id: Any,
    query: str,
    top_k: int = 5,
    candidate_k: int = 25,
    rrf_k: int = RRF_K,
    max_vector_distance: float | None = None,
    target_categories: Sequence[str] | None = None,
    rerank: bool = True,
    min_rerank_score: float | None = None,
) -> list[RetrievedEvidence]:
    """
    Combine vector and keyword retrieval using RRF and Cross-Encoder reranking.

    - Gathers candidate pool from pgvector and PostgreSQL full-text search.
    - Applies category-aware boosting without hard-excluding other categories.
    - Fuses results with Reciprocal Rank Fusion (RRF).
    - If rerank=True, scores the top candidates with the local Cross-Encoder.
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
    query_vector = embed_query(query)

    vector_results = _vector_search(
        db,
        company_id=company_id,
        query_vector=query_vector,
        limit=min(candidate_k, 30),
        max_distance=max_vector_distance,
        target_categories=target_categories,
    )

    keyword_results = _keyword_search(
        db,
        company_id=company_id,
        query=query,
        limit=min(candidate_k, 30),
        target_categories=target_categories,
    )

    candidates: dict[Any, tuple[RagDocumentChunk, str | None, str | None]] = {}
    scores: dict[Any, float] = {}
    vector_ranks: dict[Any, int] = {}
    keyword_ranks: dict[Any, int] = {}
    vector_distances: dict[Any, float] = {}

    target_cat_set = {
        c.strip().casefold()
        for c in (target_categories or [])
        if c and c.strip()
    }

    for rank, (chunk, cat_name, comp_name, distance) in enumerate(
        vector_results,
        start=1,
    ):
        chunk_id = chunk.chunk_id
        candidates[chunk_id] = (chunk, cat_name, comp_name)
        vector_ranks[chunk_id] = rank
        vector_distances[chunk_id] = distance
        scores[chunk_id] = (
            scores.get(chunk_id, 0.0)
            + 1.0 / (rrf_k + rank)
        )
        # Gentle category boost: ensures targeted category ranks securely into rerank candidate pool
        if cat_name and cat_name.casefold() in target_cat_set:
            scores[chunk_id] += 0.5 / rrf_k

    for rank, (chunk, cat_name, comp_name) in enumerate(
        keyword_results,
        start=1,
    ):
        chunk_id = chunk.chunk_id
        if chunk_id not in candidates:
            candidates[chunk_id] = (chunk, cat_name, comp_name)
        keyword_ranks[chunk_id] = rank
        scores[chunk_id] = (
            scores.get(chunk_id, 0.0)
            + 1.0 / (rrf_k + rank)
        )
        if cat_name and cat_name.casefold() in target_cat_set:
            scores[chunk_id] += 0.5 / rrf_k

    # Select candidates for reranking
    ordered_ids = sorted(
        candidates,
        key=lambda chunk_id: (
            -scores[chunk_id],
            str(chunk_id),
        ),
    )[:min(len(candidates), 30)]

    candidate_evidence: list[RetrievedEvidence] = []
    for chunk_id in ordered_ids:
        chunk, cat_name, comp_name = candidates[chunk_id]
        candidate_evidence.append(
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
                vector_distance=vector_distances.get(chunk_id),
                vector_rank=vector_ranks.get(chunk_id),
                keyword_rank=keyword_ranks.get(chunk_id),
                rrf_score=scores[chunk_id],
                category_name=cat_name,
                company_name=comp_name,
            )
        )

    if not candidate_evidence:
        return []

    if not rerank:
        return candidate_evidence[:top_k]

    # Lazy import to avoid circular dependencies
    from app.rag.reranking import rerank_evidence

    ranked = rerank_evidence(
        query=query,
        candidates=candidate_evidence,
        top_k=top_k,
        min_score=min_rerank_score,
    )

    results: list[RetrievedEvidence] = []
    for item in ranked:
        evidence = item.evidence
        results.append(
            RetrievedEvidence(
                chunk_id=evidence.chunk_id,
                company_id=evidence.company_id,
                intelligence_id=evidence.intelligence_id,
                source_id=evidence.source_id,
                page_id=evidence.page_id,
                source_url=evidence.source_url,
                heading_path=evidence.heading_path,
                content=evidence.content,
                chunk_index=evidence.chunk_index,
                vector_distance=evidence.vector_distance,
                vector_rank=evidence.vector_rank,
                keyword_rank=evidence.keyword_rank,
                rrf_score=evidence.rrf_score,
                category_name=evidence.category_name,
                company_name=evidence.company_name,
                rerank_score=item.rerank_score,
                rerank_rank=item.rerank_position,
            )
        )

    return results
