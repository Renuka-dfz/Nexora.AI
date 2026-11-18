"""
Nexora.AI - Marketing Agent Authorized Tools.

Exposes typed tool interfaces for:
- Company knowledge retrieval
- Web research (Tavily, if configured)
- Storing draft content in PostgreSQL (dim_content)
- Fetching connected social accounts (dim_social_account)
- Triggering authorized publishing and analytics lookups
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Sequence
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.modules.company_knowledge.schemas import CompanyKnowledgeContext
from app.modules.company_knowledge.services.agent_integration import (
    get_marketing_knowledge_context,
)
from app.modules.marketing.models import DimContent, DimSocialAccount
from app.modules.marketing.schemas import ALLOWED_APPROVAL_STATUSES

logger = logging.getLogger(__name__)


def retrieve_company_knowledge_tool(
    db: Session,
    *,
    company_id: UUID,
    topic: str,
    platform: str | None = None,
) -> CompanyKnowledgeContext:
    """Retrieve grounded company facts and pgvector evidence for a given marketing topic."""
    logger.info("Tool execute: retrieve_company_knowledge company=%s topic=%s", company_id, topic)
    return get_marketing_knowledge_context(
        db,
        company_id=company_id,
        topic=topic,
        platform=platform,
    )


def external_market_research_tool(
    *,
    query: str,
    max_results: int = 3,
) -> list[dict[str, Any]]:
    """
    Search external industry trends via Tavily API if configured.
    Falls back gracefully to empty list if no API key is set.
    """
    if not settings.TAVILY_API_KEY:
        logger.info("Tavily API key not configured; skipping external market search.")
        return []

    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(query=query, max_results=max_results, search_depth="basic")
        results = response.get("results", [])
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": r.get("content", ""),
            }
            for r in results
        ]
    except Exception as exc:
        logger.warning("External market research search failed: %s", exc)
        return []


def save_marketing_draft_tool(
    db: Session,
    *,
    company_id: UUID,
    title: str | None,
    content_text: str,
    platform: str,
    content_type: str = "post",
    topic: str | None = None,
    tone: str | None = None,
    approval_status: str = "pending",
) -> UUID:
    """
    Persist generated marketing copy into PostgreSQL dim_content table.
    Enforces strict company ownership, audit timestamping, and database constraints:
    - approval_status in ('draft', 'pending', 'approved', 'rejected')
    - generation_type in ('ai', 'manual') [strictly set to 'ai']
    - platform_target in varchar(30)
    - content_title in varchar(255), non-nullable
    """
    # 1. Normalize and validate approval status against PostgreSQL constraint
    norm_status = (approval_status or "pending").strip().lower()
    if norm_status == "pending_approval":
        norm_status = "pending"
    if norm_status not in ALLOWED_APPROVAL_STATUSES:
        raise ValueError(
            f"Invalid approval status '{approval_status}'. Allowed values: {sorted(ALLOWED_APPROVAL_STATUSES)}"
        )

    # 2. Database column is 'platform_target' (varchar 30, non-nullable)
    clean_platform = (platform or "linkedin").strip().lower()[:30]

    # 3. Database column is 'content_title' (varchar 255, non-nullable)
    clean_title = (title or "").strip()
    if not clean_title:
        clean_title = f"{clean_platform.capitalize()} {content_type.capitalize()} - {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
    clean_title = clean_title[:255]

    # 4. Mandatory content text check
    if not content_text or not content_text.strip():
        raise ValueError("Cannot persist empty content text into dim_content.")

    content_id = uuid4()
    record = DimContent(
        content_id=content_id,
        company_id=company_id,
        content_title=clean_title,
        content_type=content_type[:50],
        platform_target=clean_platform,
        topic=topic[:255] if topic else None,
        tone=tone[:50] if tone else None,
        content_text=content_text.strip(),
        generation_type="ai",  # Strictly "ai" for AI-generated content
        approval_status=norm_status,
        created_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.commit()
    logger.info(
        "Persisted AI marketing draft: content_id=%s company=%s platform_target=%s approval_status=%s generation_type=ai",
        content_id,
        company_id,
        clean_platform,
        norm_status,
    )
    return content_id


def get_connected_social_accounts_tool(
    db: Session,
    *,
    company_id: UUID,
    platform: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch eligible, connected social accounts for the company."""
    statement = select(DimSocialAccount).where(
        DimSocialAccount.company_id == company_id,
        DimSocialAccount.connection_status == "connected",
    )
    if platform:
        statement = statement.where(DimSocialAccount.platform == platform.lower())

    accounts = db.scalars(statement).all()
    return [
        {
            "social_account_id": str(acc.social_account_id),
            "platform": acc.platform,
            "account_name": acc.account_name,
            "account_handle": acc.account_handle,
            "external_account_id": acc.external_account_id,
        }
        for acc in accounts
    ]
