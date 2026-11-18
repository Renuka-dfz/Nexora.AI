"""
Nexora.AI - Marketing Agent State Definition.

Defines the LangGraph state schema for marketing content generation,
integrating with the hybrid company knowledge access layer, local Ollama,
factual validation safeguardrails, and human approval workflow.
"""

from __future__ import annotations

from typing import Any, TypedDict
from uuid import UUID


class MarketingAgentState(TypedDict, total=False):
    """LangGraph state schema for Marketing Agent workflows."""
    company_id: UUID
    platform: str  # linkedin, instagram, article
    topic: str
    tone: str | None
    target_audience: str | None
    instructions: str | None
    multi_stage: bool | None  # If True, forces 3-stage generation (research -> outline -> draft)
    stream: bool | None  # If True, streams tokens during draft generation
    model: str | None

    # Knowledge Layer Integration
    knowledge_mode: str  # structured, semantic, hybrid
    company_context: str  # Formatted prompt context from knowledge layer
    structured_facts: list[dict[str, Any]]
    semantic_chunks: list[dict[str, Any]]

    # Market Research & External Research (Tavily)
    is_market_research: bool
    external_research: list[dict[str, Any]] | None

    # Grounded Research Output (from rag/llm.py)
    grounded_research: dict[str, Any] | None

    # Content Planning & Drafting
    outline: dict[str, Any] | None
    draft_title: str | None
    draft_hook: str | None
    draft_content: str | None
    draft_cta: str | None
    hashtags: list[str]
    sources: list[str]

    # Validation & Safeguardrails
    validation_report: dict[str, Any] | None
    is_safe: bool

    # Persistence & Human Approval Lifecycle
    # Lifecycle: DRAFT -> PENDING -> APPROVED -> SCHEDULED/PUBLISHED/FAILED
    content_id: UUID | None
    approval_status: str  # draft, pending, approved, rejected (matches PostgreSQL dim_content constraint)
    generation_type: str  # "ai" (matches PostgreSQL dim_content constraint)
    status: str  # current node/stage status
    error: str | None
