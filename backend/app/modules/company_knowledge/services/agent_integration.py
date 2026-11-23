"""
Nexora.AI - Agent Integration Interface for Company Knowledge.

Provides dedicated, pre-configured knowledge retrieval entry points for:
1. Marketing Agent: LinkedIn posts, Instagram content, articles, and marketing recommendations.
2. Lead Qualification Agent: Inbound inquiry evaluation, capability matching, and prospect briefings.
"""

from __future__ import annotations

import logging
from typing import Sequence
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.company_knowledge.schemas import (
    CompanyKnowledgeContext,
    KnowledgeMode,
    KnowledgeQueryRequest,
)
from app.modules.company_knowledge.services.knowledge_router import (
    retrieve_company_knowledge,
)

logger = logging.getLogger(__name__)

# Default structured categories for marketing generation
MARKETING_DEFAULT_CATEGORIES = [
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Solutions",
    "Industry Expertise",
    "Case Studies",
    "Brand Identities",
]

# Default structured categories for lead qualification
LEAD_DEFAULT_CATEGORIES = [
    "Company Overview",
    "Services",
    "Products",
    "Solutions",
    "Industry Expertise",
    "Contact Information",
]


def get_marketing_knowledge_context(
    db: Session,
    *,
    company_id: UUID,
    topic: str | None = None,
    platform: str | None = None,
    content_type: str | None = None,
    categories: Sequence[str] | None = None,
    max_tokens: int = 2000,
) -> CompanyKnowledgeContext:
    """
    Retrieve knowledge context tailored for Marketing Agent draft generation.

    - If topic is provided: runs in HYBRID mode combining structured product/solution facts
      with semantic retrieval of relevant case studies and explanations.
    - If topic is omitted: runs in STRUCTURED mode retrieving core company facts.
    """
    # If explicit categories are provided, use them; otherwise allow knowledge router
    # to dynamically detect categories from topic while preserving marketing defaults
    selected_categories = list(categories) if categories else None

    # Keep query clean without platform suffixes to avoid embedding/keyword dilution
    query_text = topic.strip() if topic else None

    mode = KnowledgeMode.HYBRID if query_text else KnowledgeMode.STRUCTURED

    is_article = (
        (content_type is not None and "article" in content_type.lower())
        or (platform is not None and platform.lower() in ("article", "linkedin_article"))
        or (topic is not None and "article" in topic.lower())
    )
    top_k = 10 if is_article else 5
    token_budget = max(max_tokens, 3500) if is_article else max_tokens
    limit_struct = 50 if is_article else 40

    request = KnowledgeQueryRequest(
        company_id=company_id,
        query=query_text,
        mode=mode,
        categories=selected_categories,
        top_k_semantic=top_k,
        limit_structured=limit_struct,
        max_context_tokens=token_budget,
    )

    logger.debug(
        "Requesting marketing knowledge context: company=%s topic=%s platform=%s mode=%s",
        company_id,
        topic,
        platform,
        mode.value,
    )

    return retrieve_company_knowledge(db, request)


def get_lead_knowledge_context(
    db: Session,
    *,
    company_id: UUID,
    inquiry_text: str | None = None,
    categories: Sequence[str] | None = None,
    max_tokens: int = 2000,
) -> CompanyKnowledgeContext:
    """
    Retrieve knowledge context tailored for Lead Qualification Agent scoring.

    - If inquiry_text is provided: runs in HYBRID mode matching prospect requirements
      against company services and relevant industry case studies.
    - If inquiry_text is omitted: runs in STRUCTURED mode retrieving known offerings.
    """
    selected_categories = list(categories) if categories else LEAD_DEFAULT_CATEGORIES
    mode = KnowledgeMode.HYBRID if inquiry_text else KnowledgeMode.STRUCTURED

    request = KnowledgeQueryRequest(
        company_id=company_id,
        query=inquiry_text,
        mode=mode,
        categories=selected_categories,
        top_k_semantic=5,
        limit_structured=30,
        max_context_tokens=max_tokens,
    )

    logger.debug(
        "Requesting lead knowledge context: company=%s inquiry_len=%d mode=%s",
        company_id,
        len(inquiry_text or ""),
        mode.value,
    )

    return retrieve_company_knowledge(db, request)
