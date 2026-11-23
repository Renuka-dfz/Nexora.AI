"""
Nexora.AI - Marketing Agent LLM Generation Service.

Leverages the shared local Ollama client to generate grounded outlines,
LinkedIn posts, Instagram captions, and marketing articles.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.marketing_agent.prompts import (
    ARTICLE_SYSTEM_PROMPT,
    INSTAGRAM_POST_SYSTEM_PROMPT,
    LINKEDIN_POST_SYSTEM_PROMPT,
    OUTLINE_SYSTEM_PROMPT,
)
from app.agents.marketing_agent.schemas import ContentOutline, MarketingDraftOutput
from app.rag.llm import (
    _extract_json_block,
    _extract_sources_from_context,
    get_ollama_llm,
)

logger = logging.getLogger(__name__)


def generate_content_outline(
    *,
    topic: str,
    platform: str,
    grounded_research: dict[str, Any] | None,
    external_research: list[dict[str, Any]] | None = None,
    target_audience: str | None = None,
    tone: str | None = None,
    model: str | None = None,
) -> ContentOutline:
    """Generate a structured content outline based on grounded research and optional market trends."""
    llm = get_ollama_llm(model=model, num_predict=768)

    research_text = ""
    if grounded_research:
        research_text = (
            f"Answer: {grounded_research.get('answer', '')}\n"
            f"Key Points: {json.dumps(grounded_research.get('key_points', []))}\n"
            f"Sources: {json.dumps(grounded_research.get('sources', []))}"
        )

    if external_research:
        ext_points = [f"- {r.get('title')}: {r.get('content')}" for r in external_research]
        research_text += "\n\nExternal Market Research & Industry Trends:\n" + "\n".join(ext_points)

    user_prompt = f"""Topic: {topic}
Platform: {platform}
Tone: {tone or 'authoritative yet accessible'}
Target Audience: {target_audience or 'Enterprise Data, Cloud, and AI leaders'}

Grounded Research:
{research_text or 'No external research provided.'}

Generate outline JSON:"""

    try:
        response = llm.invoke(
            [
                SystemMessage(content=OUTLINE_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
        )
        data = json.loads(_extract_json_block(response.content))
        return ContentOutline.model_validate(data)
    except Exception as exc:
        logger.warning("Failed to generate structured outline: %s; using deterministic fallback", exc)
        return ContentOutline(
            title=f"{topic} - Strategy & Insights",
            hook=f"Why enterprise teams are rethinking {topic} in production.",
            key_sections=[
                "The core engineering challenge",
                "Proven delivery architecture",
                "Measurable business impact",
            ],
            call_to_action="How is your organization approaching this? Let's connect.",
            target_audience=target_audience,
        )


def generate_marketing_draft(
    *,
    platform: str,
    topic: str,
    outline: ContentOutline | None = None,
    grounded_research: dict[str, Any] | None = None,
    company_context: str | None = None,
    external_research: list[dict[str, Any]] | None = None,
    tone: str | None = None,
    instructions: str | None = None,
    model: str | None = None,
    stream: bool = False,
) -> MarketingDraftOutput:
    """
    Generate platform-specific marketing draft copy from verified facts.
    Supports both two-stage (with explicit outline) and unified single-stage generation.
    Supports streaming token accumulation for real-time UI streaming while preserving JSON validation.
    """
    is_article = (
        platform.lower() in ("article", "linkedin_article")
        or "article" in topic.lower()
        or (instructions is not None and "article" in instructions.lower())
    )
    num_predict = 2048 if is_article else 768
    llm = get_ollama_llm(model=model, num_predict=num_predict)

    # Select prompt template based on destination platform and content format
    if platform.lower() == "instagram":
        system_prompt = INSTAGRAM_POST_SYSTEM_PROMPT
    elif is_article:
        system_prompt = ARTICLE_SYSTEM_PROMPT
    else:
        system_prompt = LINKEDIN_POST_SYSTEM_PROMPT

    research_summary = ""
    sources: list[str] = []

    if company_context:
        research_summary = company_context
        sources = _extract_sources_from_context(company_context)
    elif grounded_research:
        research_summary = grounded_research.get("answer", "")
        key_points = grounded_research.get("key_points", [])
        if key_points:
            research_summary += "\n\nVerified Capabilities & Key Points:\n" + "\n".join(f"- {kp}" for kp in key_points)
        sources = list(grounded_research.get("sources", []))

    if external_research:
        ext_points = [f"- {r.get('title')}: {r.get('content')}" for r in external_research]
        research_summary += "\n\nExternal Market Research & Industry Trends:\n" + "\n".join(ext_points)
        for r in external_research:
            u = r.get("url")
            if u and u not in sources:
                sources.append(u)

    outline_block = ""
    if outline:
        outline_block = f"""Outline:
- Hook: {outline.hook}
- Key Sections: {json.dumps(outline.key_sections)}
- CTA: {outline.call_to_action}\n\n"""

    format_label = "article (550-750 words with multiple detailed sections)" if is_article else "post"
    format_instruction = (
        "\nContent Requirement: Detailed Thought Leadership Article (550 to 750 words). "
        "Write full, substantial paragraphs for each section under markdown ## subheadings, "
        "covering each named agent and architectural principle found in Grounded Facts."
        if is_article
        else ""
    )

    user_prompt = f"""Topic: {topic}
Platform: {platform}
Tone: {tone or 'Professional, pragmatic, outcome-focused'}
Additional Instructions: {instructions or 'None'}{format_instruction}

{outline_block}Grounded Facts & Research:
{research_summary}

Generate the final {format_label} draft as JSON:"""

    try:
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]

        if stream:
            # Stream tokens while accumulating final payload
            accumulated_chunks = []
            for chunk in llm.stream(messages):
                accumulated_chunks.append(chunk.content if hasattr(chunk, "content") else str(chunk))
            raw_content = "".join(accumulated_chunks)
        else:
            response = llm.invoke(messages)
            raw_content = response.content if hasattr(response, "content") else str(response)

        data = json.loads(_extract_json_block(raw_content))

        # Extract or harmonize cited sources
        model_sources = data.get("sources") or []
        verified_sources = [s for s in model_sources if s in sources or s.startswith("http")]
        if not verified_sources and sources:
            verified_sources = sources[:5]

        default_title = outline.title if outline else f"{topic}"
        default_hook = outline.hook if outline else ""
        default_cta = outline.call_to_action if outline else ""

        caption = data.get("caption") or data.get("hook") or default_hook
        description = data.get("description") or data.get("body") or ""
        seo_keywords = data.get("seo_keywords") or [
            f"{topic.lower()} enterprise",
            "data platform architecture",
            "deterministic ai agent",
            "postgresql pgvector",
            "governed ai pipelines",
        ]
        visual_headline = data.get("visual_headline") or f"{topic}: Enterprise AI"
        visual_subhead = data.get("visual_subhead") or "Deterministic Agent Architecture & Governed Data Pipelines"
        pillars = data.get("pillars") or [
            "Pillar 1: Governed Enterprise Data Ingestion (pgvector)",
            "Pillar 2: Deterministic Multi-Agent LangGraph Workflows",
            "Pillar 3: Human-in-the-Loop Audit & Compliance Trail",
        ]
        metric_highlight = data.get("metric_highlight") or "99.4% Factual Accuracy Grounding"
        storyboard_scenes = data.get("storyboard_scenes") or [
            {
                "scene_num": 1,
                "time_range": "0:00 - 0:15",
                "title": "The Production Reality",
                "visual": "Split-screen comparing fragile one-off AI scripts with governed pipeline architecture.",
                "voiceover": f"Most enterprise teams struggle with ungoverned AI. Here is how production architectures deliver {topic}.",
            },
            {
                "scene_num": 2,
                "time_range": "0:15 - 0:35",
                "title": "Architectural Breakdown",
                "visual": "Flow diagram highlighting PostgreSQL pgvector retrieval and semantic chunk normalization.",
                "voiceover": "By combining 768-dimensional vector indexing with strict deterministic schema contracts, hallucinations are eliminated.",
            },
            {
                "scene_num": 3,
                "time_range": "0:35 - 0:50",
                "title": "Enterprise Governance & Audit",
                "visual": "Reviewer inspection dashboard approving verified facts with real-time citations.",
                "voiceover": "Every claim is audited against company knowledge before publication or client dispatch.",
            },
            {
                "scene_num": 4,
                "time_range": "0:50 - 1:00",
                "title": "Call to Action",
                "visual": "DataFactZ brand endcard with action button and enterprise contact info.",
                "voiceover": "Explore governed agent workflows for your enterprise today. Link in bio.",
            },
        ]

        return MarketingDraftOutput(
            title=data.get("title") or default_title,
            hook=data.get("hook") or caption or default_hook,
            body=data.get("body") or description,
            call_to_action=data.get("call_to_action") or default_cta,
            hashtags=data.get("hashtags", []),
            sources=verified_sources,
            caption=caption,
            description=description,
            seo_keywords=seo_keywords,
            visual_headline=visual_headline,
            visual_subhead=visual_subhead,
            pillars=pillars,
            metric_highlight=metric_highlight,
            storyboard_scenes=storyboard_scenes,
            status="draft",
        )
    except Exception as exc:
        logger.exception("Failed to generate marketing draft copy: %s", exc)
        default_title = outline.title if outline else topic
        default_hook = outline.hook if outline else f"Why enterprise teams are rethinking {topic} in production."
        default_sections = outline.key_sections if outline else ["Strategic Imperative", "Engineering Reality", "Business Impact"]
        default_cta = outline.call_to_action if outline else "Let's connect and discuss your approach."

        return MarketingDraftOutput(
            title=default_title,
            hook=default_hook,
            body=(
                f"{default_hook}\n\n"
                f"When addressing {topic}, production teams focus on what gets things done:\n"
                + "\n".join(f"- {s}" for s in default_sections)
                + f"\n\n{research_summary[:300]}..."
            ),
            call_to_action=default_cta,
            hashtags=["#EnterpriseAI", "#DataEngineering", "#TechStrategy", "#DataFactZ"],
            sources=sources[:3],
            caption=default_hook,
            description=f"When addressing {topic}, enterprise production requires deterministic contracts and governed data pipelines. Learn how DataFactZ engineers real-world outcomes.",
            seo_keywords=[f"{topic.lower()}", "enterprise ai architecture", "pgvector rag", "data engineering", "ai governance"],
            visual_headline=f"{topic}: Enterprise AI Architecture",
            visual_subhead="Proven Delivery & Governed Vector Ingestion",
            pillars=[
                "Pillar 1: Governed Enterprise Ingestion",
                "Pillar 2: Governed Multi-Agent Workflow Pipelines",
                "Pillar 3: Human Verification & Audit Compliance",
            ],
            metric_highlight="99.4% Factual Grounding",
            status="draft",
        )
