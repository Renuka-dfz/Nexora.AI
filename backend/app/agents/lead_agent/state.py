"""
Nexora.AI - Lead Qualification Agent State Definition.

Defines the LangGraph state schema for inbound lead evaluation,
integrating with the hybrid company knowledge access layer, deterministic
scoring, local Ollama explanations, and human review.
"""

from __future__ import annotations

from typing import Any, TypedDict
from uuid import UUID


class LeadAgentState(TypedDict, total=False):
    """LangGraph state schema for Lead Qualification Agent workflows."""
    company_id: UUID
    lead_id: UUID | None
    full_name: str | None
    email: str | None
    organization: str | None
    inquiry_text: str
    source_id: UUID | None

    # Knowledge Layer Integration
    knowledge_mode: str  # structured, semantic, hybrid
    company_context: str  # Formatted prompt context from knowledge layer
    structured_facts: list[dict[str, Any]]
    semantic_chunks: list[dict[str, Any]]

    # Grounded Research Output (from rag/llm.py)
    grounded_research: dict[str, Any] | None

    # Service Matching & Intent Classification
    matched_services: list[dict[str, Any]]
    intent: str | None  # low, medium, high, unknown
    intent_score: float | None

    # Deterministic Rule-Based Scoring (0-100) & Status
    lead_score: int | None
    confidence_score: float | None
    qualification_status: str | None  # qualified, nurture, unqualified, pending

    # LLM Explanations & Follow-up Recommendations
    qualification_summary: str | None
    recommended_action: str | None

    # Validation & Persistence
    validation_report: dict[str, Any] | None
    qualification_id: UUID | None
    status: str  # current node/stage status
    error: str | None
