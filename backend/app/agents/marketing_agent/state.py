"""
Nexora.AI - Marketing Agent State Definition.

Defines the LangGraph state schema for marketing content generation,
integrating with the hybrid company knowledge access layer.
"""

from __future__ import annotations

from typing import Any, TypedDict
from uuid import UUID


class MarketingAgentState(TypedDict, total=False):
    """LangGraph state schema for Marketing Agent workflows."""
    company_id: UUID
    platform: str  # linkedin, instagram, article, etc.
    topic: str
    tone: str | None
    target_audience: str | None

    # Knowledge Layer Integration
    knowledge_mode: str  # structured, semantic, hybrid
    company_context: str  # Formatted prompt context from knowledge layer
    structured_facts: list[dict[str, Any]]
    semantic_chunks: list[dict[str, Any]]

    # Output Drafts & Review
    draft_title: str | None
    draft_content: str | None
    content_id: UUID | None
    status: str  # pending_context, drafted, pending_review, approved, rejected
    error: str | None
