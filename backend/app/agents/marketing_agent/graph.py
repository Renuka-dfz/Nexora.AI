"""
Nexora.AI - Marketing Agent LangGraph Workflow & Knowledge Integration.

Connects the Marketing Agent to the shared Company Knowledge Access Layer.
Demonstrates structured retrieval for core facts, semantic RAG for case studies,
and hybrid mode for rich, company-grounded drafts.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.agents.marketing_agent.state import MarketingAgentState
from app.modules.company_knowledge.services.agent_integration import (
    get_marketing_knowledge_context,
)

logger = logging.getLogger(__name__)


def retrieve_marketing_knowledge_node(
    state: MarketingAgentState,
    db: Session,
) -> MarketingAgentState:
    """
    LangGraph node: Ingest verified company knowledge via the hybrid access layer.

    - Uses structured facts for company overview, services, products, tech stack.
    - Uses semantic retrieval for relevant case studies and explanations.
    - Produces a secure, bounded <company_context> prompt string.
    """
    company_id: UUID = state["company_id"]
    topic: str | None = state.get("topic")
    platform: str | None = state.get("platform")

    logger.info(
        "Marketing Agent retrieving knowledge: company_id=%s topic=%s platform=%s",
        company_id,
        topic,
        platform,
    )

    context_payload = get_marketing_knowledge_context(
        db,
        company_id=company_id,
        topic=topic,
        platform=platform,
    )

    return {
        **state,
        "knowledge_mode": context_payload.mode.value,
        "company_context": context_payload.context_text,
        "structured_facts": [
            f.model_dump() for f in context_payload.structured_facts
        ],
        "semantic_chunks": [
            c.model_dump() for c in context_payload.semantic_results
        ],
        "status": "context_retrieved",
    }
