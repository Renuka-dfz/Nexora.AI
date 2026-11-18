"""
Nexora.AI - Lead Qualification Agent LangGraph Workflow & Node Implementation.

Orchestrates the inbound lead qualification workflow:
1. intake_lead_node: Validates prospect info and finds/creates DimLead record.
2. retrieve_knowledge_node: Ingests company solutions, services, and case studies.
3. classify_intent_node: Analyzes intent (high/medium/low) using local Ollama.
4. match_services_node: Connects inquiry to verified company offerings.
5. score_lead_node: Deterministically calculates numerical score (0-100) and status.
6. generate_recommendation_node: LLM explains rationale & recommends next sales action.
7. validate_qualification_node: Safeguardrails verify safety, privacy, & grounding.
8. persist_qualification_node: Stores record in PostgreSQL (fact_lead_qualification).
"""

from __future__ import annotations

import logging
import re
from typing import Any
from uuid import UUID

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.agents.lead_agent.llm import (
    classify_lead_intent,
    explain_qualification_recommendation,
    match_company_services,
)
from app.agents.lead_agent.safeguardrails import validate_lead_qualification
from app.agents.lead_agent.schemas import ServiceMatchResult
from app.agents.lead_agent.state import LeadAgentState
from app.agents.lead_agent.tools import (
    get_lead_knowledge_tool,
    get_or_create_lead_tool,
    save_lead_qualification_tool,
)

logger = logging.getLogger(__name__)


# ============================================================
# NODE 1: LEAD INTAKE
# ============================================================
def intake_lead_node(state: LeadAgentState, db: Session) -> LeadAgentState:
    """Validate prospect inquiry and ensure DimLead record exists."""
    company_id: UUID = state["company_id"]
    inquiry_text: str = (state.get("inquiry_text") or "").strip()

    if not inquiry_text:
        return {
            **state,
            "status": "failed",
            "error": "Inquiry text cannot be empty for lead qualification.",
        }

    lead_record = get_or_create_lead_tool(
        db,
        company_id=company_id,
        lead_id=state.get("lead_id"),
        full_name=state.get("full_name"),
        email=state.get("email"),
        organization=state.get("organization"),
    )

    return {
        **state,
        "lead_id": lead_record.lead_id,
        "full_name": lead_record.full_name,
        "organization": lead_record.organization,
        "status": "lead_ingested",
    }


# ============================================================
# NODE 2: RETRIEVE COMPANY KNOWLEDGE
# ============================================================
def retrieve_lead_knowledge_node(
    state: LeadAgentState,
    db: Session,
) -> LeadAgentState:
    """Ingest company offerings, solutions, and relevant case studies."""
    company_id: UUID = state["company_id"]
    inquiry_text: str = state["inquiry_text"]

    context_payload = get_lead_knowledge_tool(
        db,
        company_id=company_id,
        inquiry_text=inquiry_text,
    )

    return {
        **state,
        "knowledge_mode": context_payload.mode.value,
        "company_context": context_payload.context_text,
        "structured_facts": [f.model_dump() for f in context_payload.structured_facts],
        "semantic_chunks": [c.model_dump() for c in context_payload.semantic_results],
        "status": "knowledge_retrieved",
    }


# ============================================================
# NODE 3: CLASSIFY INTENT
# ============================================================
def classify_intent_node(state: LeadAgentState) -> LeadAgentState:
    """Classify inquiry intent level (high/medium/low) using local LLM."""
    inquiry_text: str = state["inquiry_text"]
    intent_data = classify_lead_intent(inquiry_text)

    intent_level = intent_data.get("intent_level", "medium")
    intent_score = float(intent_data.get("intent_score", 0.5))

    return {
        **state,
        "intent": intent_level,
        "intent_score": intent_score,
        "status": "intent_classified",
    }


# ============================================================
# NODE 4: MATCH COMPANY SERVICES
# ============================================================
def match_services_node(state: LeadAgentState) -> LeadAgentState:
    """Match inquiry to specific company services from verified context."""
    inquiry_text: str = state["inquiry_text"]
    company_context: str = state.get("company_context", "")

    matched = match_company_services(
        inquiry_text=inquiry_text,
        company_context=company_context,
    )

    return {
        **state,
        "matched_services": [m.model_dump() for m in matched],
        "status": "services_matched",
    }


# ============================================================
# NODE 5: RULE-BASED DETERMINISTIC LEAD SCORING
# ============================================================
def score_lead_node(state: LeadAgentState) -> LeadAgentState:
    """
    Deterministically calculate lead_score (0-100) and qualification_status.
    The LLM is NOT permitted to invent arbitrary scores.
    """
    intent = (state.get("intent") or "medium").lower()
    matched_services = state.get("matched_services") or []
    org = state.get("organization")
    inquiry = state.get("inquiry_text", "")

    # 1. Base Intent Points (0 - 50)
    intent_points = {
        "high": 48,
        "medium": 28,
        "low": 12,
        "unknown": 5,
    }.get(intent, 20)

    # 2. Service Alignment Points (0 - 24)
    service_points = min(len(matched_services) * 8, 24)

    # 3. Firmographic Clarity Points (0 - 15)
    firm_points = 15 if (org and len(org.strip()) > 2) else 5

    # 4. Project Specificity / Timeline / Volume Markers (0 - 13)
    has_metrics = bool(re.search(r"\b(\d+|timeline|q[1-4]|budget|rfp|migration|immediate)\b", inquiry, re.I))
    spec_points = 13 if has_metrics else 5

    raw_score = intent_points + service_points + firm_points + spec_points
    lead_score = max(0, min(100, raw_score))

    # Determine status by deterministic thresholds
    if lead_score >= 70:
        status_val = "qualified"
        confidence = 0.90
    elif lead_score >= 45:
        status_val = "nurture"
        confidence = 0.80
    else:
        status_val = "unqualified"
        confidence = 0.70

    return {
        **state,
        "lead_score": lead_score,
        "confidence_score": confidence,
        "qualification_status": status_val,
        "status": "lead_scored",
    }


# ============================================================
# NODE 6: GENERATE RECOMMENDATION & EXPLANATION
# ============================================================
def generate_recommendation_node(state: LeadAgentState) -> LeadAgentState:
    """Invoke local Ollama to draft the human-readable explanation and next action."""
    inquiry_text: str = state["inquiry_text"]
    prospect_org: str | None = state.get("organization")
    intent_level = state.get("intent") or "medium"
    lead_score = state.get("lead_score") or 50
    matched_raw = state.get("matched_services") or []
    matched_services = [ServiceMatchResult.model_validate(m) for m in matched_raw]

    explanation = explain_qualification_recommendation(
        inquiry_text=inquiry_text,
        prospect_organization=prospect_org,
        intent_level=intent_level,
        lead_score=lead_score,
        matched_services=matched_services,
    )

    return {
        **state,
        "qualification_summary": explanation.get("qualification_summary"),
        "recommended_action": explanation.get("recommended_action"),
        "status": "recommendation_drafted",
    }


# ============================================================
# NODE 7: VALIDATE QUALIFICATION (SAFEGUARDRAILS)
# ============================================================
def validate_qualification_node(state: LeadAgentState) -> LeadAgentState:
    """Verify absence of PII leakage, ungrounded offerings, or unauthorized actions."""
    inquiry_text: str = state.get("inquiry_text", "")
    summary: str = state.get("qualification_summary", "")
    action: str = state.get("recommended_action", "")
    matched_raw = state.get("matched_services") or []
    matched_names = [m.get("service_name", "") for m in matched_raw]
    company_context: str = state.get("company_context", "")

    report = validate_lead_qualification(
        inquiry_text=inquiry_text,
        qualification_summary=summary,
        recommended_action=action,
        matched_services=matched_names,
        company_context=company_context,
    )

    return {
        **state,
        "validation_report": report.model_dump(),
        "status": "qualification_validated",
    }


# ============================================================
# NODE 8: PERSIST QUALIFICATION (FACT TABLE)
# ============================================================
def persist_qualification_node(
    state: LeadAgentState,
    db: Session,
) -> LeadAgentState:
    """Store the evaluated lead record in fact_lead_qualification."""
    company_id: UUID = state["company_id"]
    lead_id: UUID = state["lead_id"]
    source_id: UUID | None = state.get("source_id")
    lead_score: int = state.get("lead_score", 50)
    confidence: float = state.get("confidence_score", 0.8)
    intent: str = state.get("intent", "medium")
    qual_status: str = state.get("qualification_status", "pending")
    action: str | None = state.get("recommended_action")

    qual_id = save_lead_qualification_tool(
        db,
        company_id=company_id,
        lead_id=lead_id,
        source_id=source_id,
        lead_score=lead_score,
        confidence_score=confidence,
        intent_level=intent,
        qualification_status=qual_status,
        recommended_action=action,
    )

    return {
        **state,
        "qualification_id": qual_id,
        "status": "completed_pending_review",
    }


# ============================================================
# WORKFLOW GRAPH BUILDER
# ============================================================
def build_lead_agent_graph(db: Session) -> Any:
    """Compile the complete LangGraph StateGraph for the Lead Qualification Agent."""
    workflow = StateGraph(LeadAgentState)

    workflow.add_node("intake_lead", lambda s: intake_lead_node(s, db))
    workflow.add_node("retrieve_knowledge", lambda s: retrieve_lead_knowledge_node(s, db))
    workflow.add_node("classify_intent", classify_intent_node)
    workflow.add_node("match_services", match_services_node)
    workflow.add_node("score_lead", score_lead_node)
    workflow.add_node("generate_recommendation", generate_recommendation_node)
    workflow.add_node("validate_qualification", validate_qualification_node)
    workflow.add_node("persist_qualification", lambda s: persist_qualification_node(s, db))

    workflow.add_edge(START, "intake_lead")
    workflow.add_edge("intake_lead", "retrieve_knowledge")
    workflow.add_edge("retrieve_knowledge", "classify_intent")
    workflow.add_edge("classify_intent", "match_services")
    workflow.add_edge("match_services", "score_lead")
    workflow.add_edge("score_lead", "generate_recommendation")
    workflow.add_edge("generate_recommendation", "validate_qualification")
    workflow.add_edge("validate_qualification", "persist_qualification")
    workflow.add_edge("persist_qualification", END)

    return workflow.compile()
