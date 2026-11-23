"""
Nexora.AI - Deterministic Company Knowledge Query Router & Hybrid Retrieval Service.

Combines direct PostgreSQL queries with pgvector-based semantic RAG retrieval and
Cross-Encoder reranking. Automatically routes requests based on task intent and caller
parameters without requiring an expensive extra LLM call.

Architecture:
- Deterministic router: selects STRUCTURED, SEMANTIC, or HYBRID mode.
- Category-aware intent detection: detects target knowledge categories (e.g. Case Studies)
  and propagates them to both structured queries and pgvector/keyword retrieval.
- Cross-Encoder reranking: candidates are reranked using ms-marco-MiniLM-L6-v2 enriched
  with company and category context.
- Fallback resilience: If pgvector is empty or returns no matches, falls back to
  targeted structured PostgreSQL facts without presenting unrelated facts as answers.
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

# Mapping query intent patterns to Company Intelligence categories
CATEGORY_INTENT_PATTERNS: list[tuple[re.Pattern, list[str]]] = [
    (
        re.compile(
            r"\b(ai\s*agents?|autonomous\s*agents?|agentic(\s*workflows?)?|intelligent\s*agents?|agents?)\b",
            re.I,
        ),
        ["Products", "Solutions"],
    ),
    (
        re.compile(
            r"\b(insurance|bordereaux|geotechnical|drilling|field\s*records?|incentive\s*compensation|environmental|site\s*(history|intelligence))\b",
            re.I,
        ),
        ["Products", "Industry Expertise", "Solutions"],
    ),
    (
        re.compile(
            r"\b(case\s*stud(y|ies)|customer\s*stor(y|ies)|success\s*stor(y|ies)|client\s*stor(y|ies)|outcomes|use\s*cases?)\b",
            re.I,
        ),
        ["Case Studies"],
    ),
    (
        re.compile(
            r"\b(tech\s*stack|technolog(y|ies)|tools|frameworks|languages|cloud|infrastructure|architecture)\b",
            re.I,
        ),
        ["Technology Stack"],
    ),
    (
        re.compile(
            r"\b(services?|offerings?|capabilities)\b",
            re.I,
        ),
        ["Services"],
    ),
    (
        re.compile(
            r"\b(solutions?)\b",
            re.I,
        ),
        ["Solutions"],
    ),
    (
        re.compile(
            r"\b(products?|platforms?|features?|tooling)\b",
            re.I,
        ),
        ["Products"],
    ),
    (
        re.compile(
            r"\b(overview|about\s*(us|company)?|who\s*is|what\s*does\s*.*do|leadership|founders?|executives?)\b",
            re.I,
        ),
        ["Company Overview"],
    ),
    (
        re.compile(
            r"\b(contact|phone|email|address|headquarters|location|office)\b",
            re.I,
        ),
        ["Contact Information"],
    ),
    (
        re.compile(
            r"\b(pricing|cost|plans|tiers|rates)\b",
            re.I,
        ),
        ["Pricing"],
    ),
    (
        re.compile(
            r"\b(careers?|jobs?|openings?|hiring)\b",
            re.I,
        ),
        ["Careers"],
    ),
    (
        re.compile(
            r"\b(innovations?|research|patents?|whitepapers?)\b",
            re.I,
        ),
        ["Innovations and Research", "Knowledge Resources"],
    ),
    (
        re.compile(
            r"\b(customers?|clients?|testimonials?)\b",
            re.I,
        ),
        ["Customers"],
    ),
    (
        re.compile(
            r"\b(achievements?|awards?|recognition|milestones?)\b",
            re.I,
        ),
        ["Achievements"],
    ),
    (
        re.compile(
            r"\b(industr(y|ies)|verticals?|healthcare|finance|banking|retail|manufacturing)\b",
            re.I,
        ),
        ["Industry Expertise"],
    ),
]

# Foundational categories loaded when hybrid mode has no specific category filter
# Included Case Studies so case evidence is accessible in hybrid marketing/lead contexts
DEFAULT_HYBRID_CATEGORIES: list[str] = [
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Solutions",
    "Case Studies",
]


def detect_query_categories(query: str) -> list[str]:
    """
    Detect target Company Intelligence categories based on query intent.
    
    Returns a deduplicated list of category names matching regex patterns.
    """
    if not query or not query.strip():
        return []

    detected: list[str] = []
    for pattern, categories in CATEGORY_INTENT_PATTERNS:
        if pattern.search(query):
            for cat in categories:
                if cat not in detected:
                    detected.append(cat)

    return detected


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
    - Propagates detected category intent into semantic/hybrid retrieval.
    - Applies Cross-Encoder reranking to pick the highest confidence chunks.
    - Graceful fallback: If semantic pgvector chunks are empty, falls back to
      targeted structured facts only when category intent was identified,
      avoiding presenting unrelated facts as answers.
    - Deduplicates hybrid facts and chunks.
    """
    company = db.get(DimCompany, request.company_id)
    if company is None:
        raise ValueError(f"Company {request.company_id} does not exist.")

    company_name = company.company_name
    selected_mode = route_knowledge_query(request)
    query_str = (request.query or "").strip()

    # Detect query category intent
    detected_categories = detect_query_categories(query_str)
    if detected_categories and request.categories:
        effective_categories = list(detected_categories)
        for c in request.categories:
            if c not in effective_categories:
                effective_categories.append(c)
    elif detected_categories:
        effective_categories = detected_categories
    else:
        effective_categories = list(request.categories) if request.categories else None

    structured_facts: list[StructuredFactRead] = []
    semantic_chunks: list[SemanticChunkRead] = []

    # =====================================================
    # 1. STRUCTURED MODE
    # =====================================================
    if selected_mode == KnowledgeMode.STRUCTURED:
        target_structured_cats = request.categories or (
            detected_categories if detected_categories else None
        )
        structured_facts = get_structured_facts(
            db,
            company_id=request.company_id,
            categories=target_structured_cats,
            limit=request.limit_structured,
        )

    # =====================================================
    # 2. SEMANTIC MODE (pgvector RAG + Cross-Encoder Rerank)
    # =====================================================
    elif selected_mode == KnowledgeMode.SEMANTIC:
        raw_evidence: list[RetrievedEvidence] = []
        if query_str:
            try:
                # Semantic search with Cross-Encoder reranking & category awareness
                raw_evidence = semantic_retrieve(
                    db=db,
                    company_id=request.company_id,
                    query=query_str,
                    top_k=request.top_k_semantic,
                    target_categories=effective_categories,
                    rerank=True,
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
                        target_categories=effective_categories,
                        rerank=True,
                    )
                except Exception as inner_exc:
                    logger.warning(
                        "Hybrid retrieval also failed for company %s: %s",
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
                    rerank_score=item.rerank_score,
                    category_name=item.category_name,
                )
            )

        # Fallback: If semantic search returned no chunks, fallback to structured facts
        # ONLY if specific category intent was detected or requested, avoiding dumping
        # unrelated facts for questions that simply have no evidence.
        if not semantic_chunks:
            if effective_categories:
                logger.info(
                    "No semantic chunks retrieved for company %s; falling back to structured facts for categories %s",
                    request.company_id,
                    effective_categories,
                )
                structured_facts = get_structured_facts(
                    db,
                    company_id=request.company_id,
                    categories=effective_categories,
                    limit=request.limit_structured,
                )
            else:
                logger.info(
                    "No semantic chunks retrieved and no category targeted for company %s; returning empty context",
                    request.company_id,
                )
                structured_facts = []

    # =====================================================
    # 3. HYBRID MODE (PostgreSQL + pgvector RAG + Reranking)
    # =====================================================
    elif selected_mode == KnowledgeMode.HYBRID:
        # A. Structured Baseline: authoritative facts take precedence
        if detected_categories:
            # Prioritize detected category intent to target the specific subject
            if request.categories:
                structured_categories = list(detected_categories)
                for cat in request.categories:
                    if cat not in structured_categories:
                        structured_categories.append(cat)
            else:
                structured_categories = detected_categories
            structured_limit = request.limit_structured
        elif request.categories:
            structured_categories = request.categories
            structured_limit = request.limit_structured
        else:
            structured_categories = DEFAULT_HYBRID_CATEGORIES
            structured_limit = min(request.limit_structured, 12) if query_str else request.limit_structured

        structured_facts = get_structured_facts(
            db,
            company_id=request.company_id,
            categories=structured_categories,
            limit=structured_limit,
        )

        # B. Semantic Enrichment: retrieve relevant chunks with hybrid search & reranking
        raw_evidence = []
        if query_str:
            try:
                raw_evidence = hybrid_retrieve(
                    db=db,
                    company_id=request.company_id,
                    query=query_str,
                    top_k=request.top_k_semantic,
                    target_categories=effective_categories,
                    rerank=True,
                )
            except Exception as exc:
                logger.warning(
                    "Hybrid retrieval failed in hybrid mode for company %s: %s; falling back to semantic_retrieve",
                    request.company_id,
                    exc,
                )
                try:
                    raw_evidence = semantic_retrieve(
                        db=db,
                        company_id=request.company_id,
                        query=query_str,
                        top_k=request.top_k_semantic,
                        target_categories=effective_categories,
                        rerank=True,
                    )
                except Exception as inner_exc:
                    logger.warning(
                        "Semantic retrieval also failed in hybrid mode for company %s: %s",
                        request.company_id,
                        inner_exc,
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
                    rerank_score=item.rerank_score,
                    category_name=item.category_name,
                )
            )

    # =====================================================
    # 4. CONTEXT PREPARATION
    # =====================================================
    # Ensure sufficient facts per category for rich context (especially Products & Solutions)
    facts_per_cat = 15 if request.max_context_tokens >= 3000 else (6 if query_str else None)

    context_text = prepare_knowledge_context(
        structured_facts=structured_facts,
        semantic_chunks=semantic_chunks,
        company_name=company_name,
        max_tokens=request.max_context_tokens,
        max_facts_per_category=facts_per_cat,
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
        company_name=company_name,
        mode=selected_mode,
        structured_facts=structured_facts,
        semantic_results=semantic_chunks,
        context_text=context_text,
        total_facts=len(structured_facts),
        total_chunks=len(semantic_chunks),
    )
