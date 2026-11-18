"""
Nexora.AI - Deterministic Company Knowledge Query Router & Hybrid Retrieval Service.

Combines direct PostgreSQL queries with pgvector-based semantic RAG retrieval.
Automatically routes requests based on task intent and caller parameters without
requiring an expensive extra LLM call.

Architecture:
- Deterministic router: selects STRUCTURED, SEMANTIC, or HYBRID mode.
- Fallback resilience: If pgvector is empty or returns no matches, seamlessly falls back
  to structured PostgreSQL facts without raising exceptions.
- Deduplication: In hybrid mode, authoritative structured facts take precedence while
  semantic chunks provide contextual evidence and deep dive citations.
- Company boundary: Every query strictly enforces authorized company_id and trust status.
"""

from __future__ import annotations

import logging
import re
from typing import Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import DimCompany
from app.modules.company_knowledge.schemas import (
    CompanyKnowledgeContext,
    KnowledgeMode,
    KnowledgeQueryRequest,
    SemanticChunkRead,
    StructuredFactRead,
)
from app.modules.company_knowledge.services.knowledge_context import (
    prepare_knowledge_context,
)
from app.modules.company_knowledge.services.structured_knowledge import (
    get_structured_facts,
)
from app.rag.retrieval import (
    RetrievedEvidence,
    hybrid_retrieve,
    semantic_retrieve,
)

logger = logging.getLogger(__name__)

# Patterns indicative of structured catalog lookups
STRUCTURED_PATTERNS = [
    re.compile(r"\b(what|list|show|all)\s+(services|offerings|solutions|capabilities)\b", re.I),
    re.compile(r"\b(what|list|show|all)\s+(products|features|tooling)\b", re.I),
    re.compile(r"\b(tech\s*stack|technologies|tools|frameworks|languages)\b", re.I),
    re.compile(r"\b(contact|phone|email|address|headquarters|location|office)\b", re.I),
    re.compile(r"\b(overview|about\s+company|who\s+is|what\s+does\s+the\s+company\s+do)\b", re.I),
    re.compile(r"\b(pricing|cost|plans|tiers|rates)\b", re.I),
    re.compile(r"\b(careers|jobs|openings|hiring)\b", re.I),
]

# Patterns indicative of semantic RAG search (deep context, case studies, specific topics)
SEMANTIC_PATTERNS = [
    re.compile(r"\b(case\s*stud(y|ies)|customer\s*stor(y|ies)|success\s*stor(y|ies))\b", re.I),
    re.compile(r"\b(article|blog|whitepaper|research|publication|innovation)\b", re.I),
    re.compile(r"\b(challenges|methodology|how\s+did|explain\s+how|deep\s*dive)\b", re.I),
    re.compile(r"\b(evidence|proof|metrics|outcomes|results\s+from)\b", re.I),
]

# Patterns indicative of hybrid generation (content drafts, posts, lead pitch)
HYBRID_PATTERNS = [
    re.compile(r"\b(generate|write|draft|create)\s+(linkedin|instagram|post|article|content|copy)\b", re.I),
    re.compile(r"\b(marketing\s*(idea|campaign|recommendation|strategy))\b", re.I),
    re.compile(r"\b(pitch|lead\s*briefing|proposal|recommendation)\b", re.I),
]

# Foundational categories loaded when hybrid mode has no specific category filter
DEFAULT_HYBRID_CATEGORIES = [
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Solutions",
]


def route_knowledge_query(request: KnowledgeQueryRequest) -> KnowledgeMode:
    """
    Deterministic rule-based router selecting knowledge access mode.

    Precedence:
    1. Explicit caller mode override (if requested).
    2. Category-only requests without query text -> STRUCTURED.
    3. Query text heuristic pattern matching -> STRUCTURED, SEMANTIC, or HYBRID.
    4. Default fallback: HYBRID when query exists, STRUCTURED when query is empty.
    """
    # 1. Explicit override
    if request.mode is not None:
        return request.mode

    query_str = (request.query or "").strip()

    # 2. Category-only lookups without freeform text
    if not query_str:
        return KnowledgeMode.STRUCTURED

    # 3. Check for Hybrid generation patterns
    for pattern in HYBRID_PATTERNS:
        if pattern.search(query_str):
            return KnowledgeMode.HYBRID

    # 4. If both explicit categories and a query string are passed, use HYBRID
    if request.categories and len(request.categories) > 0 and query_str:
        return KnowledgeMode.HYBRID

    # 5. Check for Semantic exploration patterns
    for pattern in SEMANTIC_PATTERNS:
        if pattern.search(query_str):
            return KnowledgeMode.SEMANTIC

    # 6. Check for Structured catalog queries
    for pattern in STRUCTURED_PATTERNS:
        if pattern.search(query_str):
            return KnowledgeMode.STRUCTURED

    # 7. Default to HYBRID for complex/unmatched textual requests
    return KnowledgeMode.HYBRID


def retrieve_company_knowledge(
    db: Session,
    request: KnowledgeQueryRequest,
) -> CompanyKnowledgeContext:
    """
    Retrieve trusted company knowledge using the routed access mode.

    Guarantees:
    - Company exists in dim_company.
    - Zero data leakage across companies.
    - Graceful fallback: If semantic pgvector chunks are empty, structured
      PostgreSQL facts are returned rather than an error.
    - Deduplicates hybrid facts and chunks.
    """
    company = db.get(DimCompany, request.company_id)
    if company is None:
        raise ValueError(f"Company {request.company_id} does not exist.")

    company_name = company.company_name
    selected_mode = route_knowledge_query(request)
    query_str = (request.query or "").strip()

    structured_facts: list[StructuredFactRead] = []
    semantic_chunks: list[SemanticChunkRead] = []

    # =====================================================
    # 1. STRUCTURED MODE
    # =====================================================
    if selected_mode == KnowledgeMode.STRUCTURED:
        structured_facts = get_structured_facts(
            db,
            company_id=request.company_id,
            categories=request.categories,
            limit=request.limit_structured,
        )

    # =====================================================
    # 2. SEMANTIC MODE (pgvector RAG)
    # =====================================================
    elif selected_mode == KnowledgeMode.SEMANTIC:
        raw_evidence: list[RetrievedEvidence] = []
        if query_str:
            try:
                # Use pure pgvector cosine-distance search
                raw_evidence = semantic_retrieve(
                    db=db,
                    company_id=request.company_id,
                    query=query_str,
                    top_k=request.top_k_semantic,
                )
            except Exception as exc:
                logger.warning(
                    "pgvector semantic retrieval failed for company %s: %s; falling back to hybrid retrieval",
                    request.company_id,
                    exc,
                )
                try:
                    raw_evidence = hybrid_retrieve(
                        db=db,
                        company_id=request.company_id,
                        query=query_str,
                        top_k=request.top_k_semantic,
                    )
                except Exception as inner_exc:
                    logger.warning(
                        "Hybrid retrieval also failed for company %s: %s; falling back to structured facts",
                        request.company_id,
                        inner_exc,
                    )
                    raw_evidence = []

        for item in raw_evidence:
            semantic_chunks.append(
                SemanticChunkRead(
                    chunk_id=item.chunk_id,
                    fact_id=item.intelligence_id,
                    company_id=item.company_id,
                    source_url=item.source_url,
                    heading_path=item.heading_path,
                    content=item.content,
                    token_count=None,
                    score=item.rrf_score,
                    vector_distance=item.vector_distance,
                )
            )

        # Fallback: If pgvector is empty / returned no chunks, fallback to structured facts
        if not semantic_chunks:
            logger.info(
                "No semantic chunks retrieved for company %s; falling back to structured PostgreSQL facts",
                request.company_id,
            )
            structured_facts = get_structured_facts(
                db,
                company_id=request.company_id,
                categories=request.categories,
                limit=request.limit_structured,
            )

    # =====================================================
    # 3. HYBRID MODE (PostgreSQL + pgvector RAG)
    # =====================================================
    elif selected_mode == KnowledgeMode.HYBRID:
        # A. Structured Baseline: authoritative facts take precedence
        target_categories = request.categories or DEFAULT_HYBRID_CATEGORIES
        structured_facts = get_structured_facts(
            db,
            company_id=request.company_id,
            categories=target_categories,
            limit=request.limit_structured,
        )

        # B. Semantic Enrichment: retrieve relevant chunks for supporting proof
        raw_evidence = []
        if query_str:
            try:
                raw_evidence = semantic_retrieve(
                    db=db,
                    company_id=request.company_id,
                    query=query_str,
                    top_k=request.top_k_semantic,
                )
            except Exception as exc:
                logger.warning(
                    "Semantic search failed in hybrid mode for company %s: %s",
                    request.company_id,
                    exc,
                )
                raw_evidence = []

        seen_chunk_ids: set[str] = set()
        for item in raw_evidence:
            if str(item.chunk_id) in seen_chunk_ids:
                continue
            seen_chunk_ids.add(str(item.chunk_id))

            semantic_chunks.append(
                SemanticChunkRead(
                    chunk_id=item.chunk_id,
                    fact_id=item.intelligence_id,
                    company_id=item.company_id,
                    source_url=item.source_url,
                    heading_path=item.heading_path,
                    content=item.content,
                    token_count=None,
                    score=item.rrf_score,
                    vector_distance=item.vector_distance,
                )
            )

    # =====================================================
    # 4. CONTEXT PREPARATION
    # =====================================================
    context_text = prepare_knowledge_context(
        structured_facts=structured_facts,
        semantic_chunks=semantic_chunks,
        company_name=company_name,
        max_tokens=request.max_context_tokens,
    )

    logger.info(
        "Company knowledge retrieved: company=%s mode=%s facts=%d chunks=%d",
        request.company_id,
        selected_mode.value,
        len(structured_facts),
        len(semantic_chunks),
        extra={
            "company_id": str(request.company_id),
            "mode": selected_mode.value,
            "facts_count": len(structured_facts),
            "chunks_count": len(semantic_chunks),
        },
    )

    return CompanyKnowledgeContext(
        company_id=request.company_id,
        mode=selected_mode,
        structured_facts=structured_facts,
        semantic_results=semantic_chunks,
        context_text=context_text,
        total_facts=len(structured_facts),
        total_chunks=len(semantic_chunks),
    )
