"""
Nexora.AI - Marketing Agent LangGraph Workflow & Node Implementation.

Orchestrates the end-to-end grounded marketing content creation workflow:
1. understand_request_node: Parse platform, topic, and requirements.
2. retrieve_knowledge_node: Ingest verified facts & pgvector evidence from knowledge router.
3. generate_grounded_research_node: Invoke local Ollama (rag/llm.py) for structured research.
4. plan_content_node: Build a structured outline with hook, key points, and CTA.
5. generate_draft_node: Produce platform-tuned post copy (LinkedIn/Instagram/Article).
6. validate_content_node: Apply safeguardrails for prompt injection, sensitive data, & fake metrics.
7. prepare_draft_for_approval_node: Persist draft to PostgreSQL (dim_content) with status 'pending'.

Publishing is strictly decoupled from generation and requires explicit human approval.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from uuid import UUID

from langgraph.graph import END, START, StateGraph
from sqlalchemy.orm import Session

from app.agents.marketing_agent.llm import (
    generate_content_outline,
    generate_marketing_draft,
)
from app.agents.marketing_agent.safeguardrails import validate_marketing_content
from app.agents.marketing_agent.schemas import ContentOutline, MarketingDraftOutput
from app.agents.marketing_agent.state import MarketingAgentState
from app.agents.marketing_agent.tools import (
    external_market_research_tool,
    retrieve_company_knowledge_tool,
    save_marketing_draft_tool,
)
from app.rag.llm import INSUFFICIENT_INFO_MESSAGE, generate_grounded_answer

logger = logging.getLogger(__name__)


# ============================================================
# NODE 1: UNDERSTAND MARKETING REQUEST
# ============================================================
def understand_request_node(state: MarketingAgentState) -> MarketingAgentState:
    """Validate and normalize the marketing request inputs, detecting market research intent."""
    topic = state.get("topic", "").strip()
    platform = (state.get("platform") or "linkedin").strip().lower()
    tone = state.get("tone") or "authoritative yet accessible"
    instructions = state.get("instructions") or ""

    if not topic:
        return {
            **state,
            "status": "failed",
            "error": "Topic cannot be empty for marketing content generation.",
        }

    # Detect if the user's request is asking for market research / industry trends
    text_to_check = f"{topic} {instructions}".lower()
    market_research_patterns = [
        r"\bmarket\s*(research|trends?|landscape|dynamics|analysis|outlook|overview)\b",
        r"\bindustry\s*(trends?|insights?|landscape|analysis|outlook|overview)\b",
        r"\bcompetitor\s*(analysis|landscape|benchmarks?)\b",
        r"\bmacro\s*trends?\b",
        r"\bmarket\s*intelligence\b",
        r"\bexternal\s*research\b",
        r"\bemerging\s*trends?\b",
    ]
    is_market_research = any(re.search(pat, text_to_check) for pat in market_research_patterns)

    logger.info(
        "Understood marketing request: platform=%s topic=%s is_market_research=%s",
        platform,
        topic[:50],
        is_market_research,
    )
    return {
        **state,
        "platform": platform,
        "topic": topic,
        "tone": tone,
        "is_market_research": is_market_research,
        "external_research": None,
        "status": "request_understood",
    }


# ============================================================
# NODE 2: RETRIEVE COMPANY KNOWLEDGE
# ============================================================
def retrieve_marketing_knowledge_node(
    state: MarketingAgentState,
    db: Session,
) -> MarketingAgentState:
    """
    Ingest verified company facts and pgvector semantic chunks via the hybrid access layer.
    """
    company_id: UUID = state["company_id"]
    topic: str = state["topic"]
    platform: str = state.get("platform", "linkedin")

    context_payload = retrieve_company_knowledge_tool(
        db,
        company_id=company_id,
        topic=topic,
        platform=platform,
    )

    return {
        **state,
        "knowledge_mode": context_payload.mode.value,
        "company_context": context_payload.context_text,
        "structured_facts": [f.model_dump() for f in context_payload.structured_facts],
        "semantic_chunks": [c.model_dump() for c in context_payload.semantic_results],
        "status": "context_retrieved",
    }


# ============================================================
# NODE 3: GENERATE GROUNDED RESEARCH RESPONSE
# ============================================================
def generate_grounded_research_node(state: MarketingAgentState) -> MarketingAgentState:
    """
    Invoke local Ollama (via app.rag.llm) to synthesize grounded research.

    Special Rules:
    - If is_market_research is True:
        Invoke Tavily tool (external_market_research_tool) to gather live external market trends
        and industry insights, augmenting the company knowledge context.
    - If is_market_research is False:
        Rely strictly on internal company knowledge (PostgreSQL facts + pgvector).
        Do NOT invoke Tavily.
        If internal knowledge is missing or insufficient (evidence_status == "insufficient_evidence"),
        explicitly set state["status"] = "insufficient_information",
        state["draft_content"] = "I don't have enough information about this.",
        and branch directly to END to prevent hallucinating ungrounded content.
    """
    topic: str = state["topic"]
    is_market_research: bool = state.get("is_market_research", False)
    context_text: str = state.get("company_context", "")

    external_findings: list[dict[str, Any]] = []

    # Selective Tavily Tool Usage: Only when user asks for market research / trends
    if is_market_research:
        logger.info("Market research intent detected for '%s'; invoking Tavily tool.", topic[:60])
        external_findings = external_market_research_tool(query=topic, max_results=3)

        if external_findings:
            ext_lines = [
                "\n\n## External Market Research & Industry Trends (via Tavily):",
            ]
            for r in external_findings:
                ext_lines.append(f"- **{r.get('title')}**: {r.get('content')} (Source: {r.get('url')})")
            context_text = (context_text + "\n" + "\n".join(ext_lines)).strip()
    else:
        logger.info("Standard company topic '%s'; relying strictly on internal knowledge without Tavily.", topic[:60])

    model: str | None = state.get("model")
    instructions: str = state.get("instructions", "")
    research_query = (
        f"What are DataFactZ's documented AI agents, delivery methodologies, industry use cases, and data platform foundations regarding {topic}?"
    )
    research_response = generate_grounded_answer(
        question=research_query,
        company_context=context_text,
        model=model,
    )

    # Fail-closed enforcement: if NOT market research and evidence is missing/insufficient
    if not is_market_research and research_response.evidence_status == "insufficient_evidence":
        logger.warning(
            "Company knowledge RAG returned insufficient evidence for '%s'; halting pipeline fail-closed.",
            topic[:60],
        )
        return {
            **state,
            "grounded_research": research_response.model_dump(),
            "draft_content": INSUFFICIENT_INFO_MESSAGE,
            "sources": [],
            "status": "insufficient_information",
            "approval_status": "rejected",
            "is_safe": False,
        }

    # Harmonize combined sources (internal verified URLs + external Tavily URLs)
    combined_sources = list(research_response.sources)
    for r in external_findings:
        u = r.get("url")
        if u and u not in combined_sources:
            combined_sources.append(u)

    return {
        **state,
        "grounded_research": research_response.model_dump(),
        "external_research": external_findings if external_findings else None,
        "sources": combined_sources,
        "status": "research_synthesized",
    }


# ============================================================
# NODE 4: PLAN CONTENT OUTLINE
# ============================================================
def plan_content_node(state: MarketingAgentState) -> MarketingAgentState:
    """Build a structured outline with hook, narrative sections, and CTA."""
    topic: str = state["topic"]
    platform: str = state.get("platform", "linkedin")
    tone: str | None = state.get("tone")
    target_audience: str | None = state.get("target_audience")
    grounded_research = state.get("grounded_research")
    external_research = state.get("external_research")

    outline: ContentOutline = generate_content_outline(
        topic=topic,
        platform=platform,
        grounded_research=grounded_research,
        external_research=external_research,
        target_audience=target_audience,
        tone=tone,
        model=state.get("model"),
    )

    return {
        **state,
        "outline": outline.model_dump(),
        "status": "outline_planned",
    }


# ============================================================
# NODE 5: GENERATE CONTENT DRAFT
# ============================================================
def generate_draft_node(state: MarketingAgentState) -> MarketingAgentState:
    """Generate the full platform-tuned marketing copy (post or article)."""
    platform: str = state.get("platform", "linkedin")
    topic: str = state["topic"]
    outline_data = state.get("outline")
    outline = ContentOutline.model_validate(outline_data) if outline_data else None
    grounded_research = state.get("grounded_research")
    company_context = state.get("company_context")
    external_research = state.get("external_research")
    tone: str | None = state.get("tone")
    instructions: str | None = state.get("instructions")

    draft: MarketingDraftOutput = generate_marketing_draft(
        platform=platform,
        topic=topic,
        outline=outline,
        grounded_research=grounded_research,
        company_context=company_context,
        external_research=external_research,
        tone=tone,
        instructions=instructions,
        model=state.get("model"),
    )

    return {
        **state,
        "draft_title": draft.title,
        "draft_hook": draft.hook,
        "draft_content": f"{draft.hook}\n\n{draft.body}\n\n{draft.call_to_action}",
        "draft_cta": draft.call_to_action,
        "hashtags": draft.hashtags,
        "sources": draft.sources,
        "approval_status": "draft",
        "status": "draft_generated",
    }


# ============================================================
# NODE 6: VALIDATE CONTENT (SAFEGUARDRAILS)
# ============================================================
def validate_content_node(state: MarketingAgentState) -> MarketingAgentState:
    """Check draft against safety rules, prompt injections, and unverified claims."""
    content: str = state.get("draft_content", "")
    sources: list[str] = state.get("sources", [])
    evidence_text: str = state.get("company_context", "")
    platform: str = state.get("platform", "linkedin")

    report = validate_marketing_content(
        content=content,
        sources=sources,
        grounded_evidence_text=evidence_text,
        platform=platform,
    )

    return {
        **state,
        "validation_report": report.model_dump(),
        "is_safe": report.passed,
        "status": "content_validated" if report.passed else "validation_warning",
    }


# ============================================================
# NODE 7: PREPARE DRAFT FOR HUMAN APPROVAL
# ============================================================
def prepare_draft_for_approval_node(
    state: MarketingAgentState,
    db: Session,
) -> MarketingAgentState:
    """
    Persist validated draft into PostgreSQL (dim_content) with status 'pending'.
    Does NOT publish. The draft awaits explicit human review in the Content Studio.
    Guard: Rejects persistence if validation failed or evidence was insufficient.
    """
    # Guard against invalid, unvalidated, or insufficient evidence content
    if (
        not state.get("is_safe", False)
        or state.get("status") in ("insufficient_information", "validation_warning", "failed")
        or not state.get("draft_content")
        or state.get("draft_content") == INSUFFICIENT_INFO_MESSAGE
    ):
        logger.warning(
            "Skipping dim_content persistence: content failed validation (is_safe=%s, status=%s) or lacks sufficient evidence.",
            state.get("is_safe"),
            state.get("status"),
        )
        return {
            **state,
            "content_id": None,
            "approval_status": "rejected",
            "generation_type": "ai",
            "status": "persistence_skipped_failed_validation",
        }

    company_id: UUID = state["company_id"]
    title: str | None = state.get("draft_title")
    content_text: str = state.get("draft_content", "")
    platform: str = state.get("platform", "linkedin")
    topic: str | None = state.get("topic")
    tone: str | None = state.get("tone")

    content_id = save_marketing_draft_tool(
        db,
        company_id=company_id,
        title=title,
        content_text=content_text,
        platform=platform,
        content_type="post" if platform in ("linkedin", "instagram") else "article",
        topic=topic,
        tone=tone,
        approval_status="pending",
    )

    return {
        **state,
        "content_id": content_id,
        "approval_status": "pending",
        "generation_type": "ai",
        "status": "awaiting_human_approval",
    }


# ============================================================
# WORKFLOW GRAPH BUILDER
# ============================================================
def build_marketing_agent_graph(db: Session) -> Any:
    """
    Compile the complete LangGraph StateGraph for the Marketing Agent.
    """
    workflow = StateGraph(MarketingAgentState)

    # Add nodes with injected database session where required
    workflow.add_node("understand_request", understand_request_node)
    workflow.add_node("retrieve_knowledge", lambda s: retrieve_marketing_knowledge_node(s, db))
    workflow.add_node("generate_research", generate_grounded_research_node)
    workflow.add_node("plan_content", plan_content_node)
    workflow.add_node("generate_draft", generate_draft_node)
    workflow.add_node("validate_content", validate_content_node)
    workflow.add_node("prepare_approval", lambda s: prepare_draft_for_approval_node(s, db))

    def route_after_retrieve(state: MarketingAgentState) -> str:
        """
        Streamlined routing:
        - When external market research (Tavily) or multi-stage generation is explicitly requested:
          proceed through multi-stage pipeline: generate_research -> plan_content -> generate_draft.
        - For standard company marketing requests:
          proceed directly to generate_draft (unified generation, reducing LLM calls from 3 to 1).
        """
        if state.get("is_market_research") or state.get("multi_stage"):
            return "generate_research"
        return "generate_draft"

    def route_after_research(state: MarketingAgentState) -> str:
        """Route to END if information is insufficient; otherwise proceed to outline planning."""
        if state.get("status") == "insufficient_information":
            return END
        return "plan_content"

    def route_after_validation(state: MarketingAgentState) -> str:
        """Route to END if content validation failed or is unsafe; otherwise proceed to approval persistence."""
        if not state.get("is_safe", False) or state.get("status") == "validation_warning":
            logger.warning("Marketing content validation failed; terminating workflow without creating content record.")
            return END
        return "prepare_approval"

    # Define deterministic sequential workflow edges
    workflow.add_edge(START, "understand_request")
    workflow.add_edge("understand_request", "retrieve_knowledge")
    workflow.add_conditional_edges(
        "retrieve_knowledge",
        route_after_retrieve,
        {
            "generate_research": "generate_research",
            "generate_draft": "generate_draft",
        },
    )
    workflow.add_conditional_edges(
        "generate_research",
        route_after_research,
        {
            "plan_content": "plan_content",
            END: END,
        },
    )
    workflow.add_edge("plan_content", "generate_draft")
    workflow.add_edge("generate_draft", "validate_content")
    workflow.add_conditional_edges(
        "validate_content",
        route_after_validation,
        {
            "prepare_approval": "prepare_approval",
            END: END,
        },
    )
    workflow.add_edge("prepare_approval", END)

    return workflow.compile()
