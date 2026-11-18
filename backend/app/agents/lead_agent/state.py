"""
Nexora.AI - Lead Qualification Agent State Definition.

Defines the LangGraph state schema for inbound lead evaluation,
integrating with the hybrid company knowledge access layer.
"""

from __future__ import annotations

from typing import Any, TypedDict
from uuid import UUID


class LeadAgentState(TypedDict, total=False):
    """LangGraph state schema for Lead Qualification Agent workflows."""
    company_id: UUID
    lead_id: UUID | None
    prospect_name: str | None
    prospect_company: str | None
    inquiry_text: str

    # Knowledge Layer Integration
    knowledge_mode: str
    company_context: str
    structured_facts: list[dict[str, Any]]
    semantic_chunks: list[dict[str, Any]]

    # Lead Qualification Outputs
    intent: str | None  # high, medium, low, spam
    intent_score: float | None
    qualification_summary: str | None
    recommended_solutions: list[str]
    status: str
    error: str | None
