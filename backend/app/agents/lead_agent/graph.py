"""
Nexora.AI - Lead Qualification Agent LangGraph Workflow & Knowledge Integration.

Connects the Lead Qualification Agent to the shared Company Knowledge Access Layer.
Demonstrates structured retrieval for company offerings and semantic RAG for matching
inbound prospect inquiries against past solutions and case studies.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.agents.lead_agent.state import LeadAgentState
from app.modules.company_knowledge.services.agent_integration import (
    get_lead_knowledge_context,
)

logger = logging.getLogger(__name__)


def retrieve_lead_knowledge_node(
    state: LeadAgentState,
    db: Session,
) -> LeadAgentState:
    """
    LangGraph node: Ingest verified company knowledge to evaluate an inbound lead.

    - Uses structured facts for company offerings, solutions, and contact details.
    - Uses semantic retrieval for matching prospect inquiries against case studies.
    - Produces a secure, bounded <company_context> prompt string.
    """
    company_id: UUID = state["company_id"]
    inquiry_text: str | None = state.get("inquiry_text")

    logger.info(
        "Lead Agent retrieving knowledge: company_id=%s inquiry_len=%d",
        company_id,
        len(inquiry_text or ""),
    )

    context_payload = get_lead_knowledge_context(
        db,
        company_id=company_id,
        inquiry_text=inquiry_text,
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
