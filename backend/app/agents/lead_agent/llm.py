"""
Nexora.AI - Lead Qualification Agent LLM Reasoning Service.

Uses local Ollama (targeting qwen3.5:4b) to explain lead requirements,
match company services, and draft follow-up recommendations.

NOTE: Authoritative numerical lead scores (0-100) are computed deterministically
by rule logic, NOT generated arbitrarily by the LLM.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.lead_agent.prompts import (
    LEAD_EXPLANATION_SYSTEM_PROMPT,
    LEAD_INTENT_SYSTEM_PROMPT,
    SERVICE_MATCH_SYSTEM_PROMPT,
)
from app.agents.lead_agent.schemas import ServiceMatchResult
from app.rag.llm import _extract_json_block, get_ollama_llm

logger = logging.getLogger(__name__)


def classify_lead_intent(inquiry_text: str) -> dict[str, Any]:
    """Classify the prospect's intent level and core requirements using local Ollama."""
    llm = get_ollama_llm()

    user_prompt = f"""Prospect Inbound Inquiry:
\"\"\"{inquiry_text}\"\"\"

Classify intent as JSON:"""

    try:
        response = llm.invoke(
            [
                SystemMessage(content=LEAD_INTENT_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
        )
        return json.loads(_extract_json_block(response.content))
    except Exception as exc:
        logger.warning("Lead intent classification failed: %s; falling back to heuristic", exc)
        # Fallback heuristic
        inq_lower = inquiry_text.casefold()
        if any(w in inq_lower for w in ["migrate", "pricing", "cost", "hire", "rfp", "timeline", "quote", "demo"]):
            return {"intent_level": "high", "intent_score": 0.8, "core_needs": ["Project inquiry"]}
        elif len(inquiry_text.split()) > 15:
            return {"intent_level": "medium", "intent_score": 0.5, "core_needs": ["Exploratory inquiry"]}
        else:
            return {"intent_level": "low", "intent_score": 0.3, "core_needs": ["General inquiry"]}


def match_company_services(
    *,
    inquiry_text: str,
    company_context: str,
) -> list[ServiceMatchResult]:
    """Identify which verified company services match the prospect's inquiry."""
    llm = get_ollama_llm()

    user_prompt = f"""Prospect Inquiry:
\"\"\"{inquiry_text}\"\"\"

Verified Company Offerings & Context:
{company_context[:2500]}

Match services as JSON:"""

    try:
        response = llm.invoke(
            [
                SystemMessage(content=SERVICE_MATCH_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
        )
        data = json.loads(_extract_json_block(response.content))
        raw_matches = data.get("matched_services", [])
        return [ServiceMatchResult.model_validate(m) for m in raw_matches]
    except Exception as exc:
        logger.warning("Service matching failed: %s; using deterministic fallback", exc)
        return [
            ServiceMatchResult(
                service_name="Enterprise Data & AI Advisory",
                category="Services",
                confidence=0.5,
                reasoning="General enterprise data consultation aligned with prospect requirements.",
            )
        ]


def explain_qualification_recommendation(
    *,
    inquiry_text: str,
    prospect_organization: str | None,
    intent_level: str,
    lead_score: int,
    matched_services: list[ServiceMatchResult],
) -> dict[str, str]:
    """Generate concise qualification summary and actionable follow-up for sales team."""
    llm = get_ollama_llm()

    services_summary = ", ".join(m.service_name for m in matched_services)

    user_prompt = f"""Prospect Organization: {prospect_organization or 'Unspecified'}
Prospect Inquiry: \"\"\"{inquiry_text}\"\"\"
Deterministic Lead Score: {lead_score}/100
Classified Intent Level: {intent_level}
Matched Offerings: {services_summary}

Explain qualification and recommend follow-up as JSON:"""

    try:
        response = llm.invoke(
            [
                SystemMessage(content=LEAD_EXPLANATION_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
        )
        data = json.loads(_extract_json_block(response.content))
        return {
            "qualification_summary": data.get("qualification_summary", "Prospect evaluated against company offerings."),
            "recommended_action": data.get("recommended_action", "Review inquiry details and schedule discovery call."),
        }
    except Exception as exc:
        logger.warning("Qualification explanation generation failed: %s", exc)
        return {
            "qualification_summary": f"Inquiry from {prospect_organization or 'prospect'} scored {lead_score}/100 with {intent_level} intent. Matched services: {services_summary}.",
            "recommended_action": "Schedule an initial discovery conversation with practice specialist.",
        }
