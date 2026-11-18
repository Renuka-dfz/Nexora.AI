"""
Nexora.AI - Lead Qualification Agent Memory & History Management.

Manages conversational state and past qualification records via LangGraph checkpointer
and PostgreSQL database queries without storing unneeded sensitive data.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from langgraph.checkpoint.memory import MemorySaver
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.lead_management.models import FactLeadQualification

logger = logging.getLogger(__name__)

_lead_checkpointer = MemorySaver()


def get_lead_agent_checkpointer() -> MemorySaver:
    """Return reusable LangGraph checkpointer for Lead Agent workflow execution."""
    return _lead_checkpointer


def get_lead_qualification_history(
    db: Session,
    *,
    lead_id: UUID,
    company_id: UUID,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Retrieve prior evaluation scores and recommended actions for a lead."""
    stmt = (
        select(FactLeadQualification)
        .where(
            FactLeadQualification.lead_id == lead_id,
            FactLeadQualification.company_id == company_id,
        )
        .order_by(FactLeadQualification.evaluated_at.desc())
        .limit(limit)
    )
    records = db.scalars(stmt).all()
    return [
        {
            "qualification_id": str(r.qualification_id),
            "lead_score": r.lead_score,
            "intent_level": r.intent_level,
            "qualification_status": r.qualification_status,
            "recommended_action": r.recommended_action,
            "evaluated_at": r.evaluated_at.isoformat() if r.evaluated_at else None,
        }
        for r in records
    ]
