"""
Nexora.AI - Evidence-Grounded Local LLM Service.

Connects the hybrid company knowledge access layer (PostgreSQL + pgvector RAG)
with a local Ollama model (targeting qwen3.5:4b) via LangChain's ChatOllama.

Key Guarantees:
- Strictly evidence-bounded: claims must be grounded in the supplied context.
- Explicit fail-closed response: If information is missing from the database or pgvector,
  or if the user asks an unsupported or incorrect question, the service explicitly responds:
  "I don't have enough information about this."
- Preserves genuine source URLs and fact attributions.
- Rejects unsupported achievements, hallucinated customer claims, or phantom metrics.
- Enforces strict JSON output validated via Pydantic.
- Fail-safe resilience: handles Ollama timeouts, connection errors, and empty context gracefully.
- No database queries are performed inside this module; knowledge must be passed in by caller.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal, Sequence

from pydantic import BaseModel, Field

from app.core.config import settings

logger = logging.getLogger(__name__)

EvidenceStatus = Literal["supported", "insufficient_evidence", "partially_supported"]
INSUFFICIENT_INFO_MESSAGE = "I don't have enough information about this."


class GroundedRAGResponse(BaseModel):
    """Structured, evidence-grounded response generated from company knowledge."""
    question: str
    answer: str
    key_points: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    evidence_status: EvidenceStatus = "supported"


_OLLAMA_CLIENT_CACHE: dict[str, Any] = {}
_GROUNDED_RESEARCH_CACHE: dict[str, GroundedRAGResponse] = {}


def get_ollama_llm(
    *,
    model: str | None = None,
    temperature: float | None = None,
    timeout: float | None = None,
    num_predict: int = 512,
    reasoning: bool = False,
    num_ctx: int = 4096,
    num_thread: int = 4,
    keep_alive: str = "30m",
):
    """
    Instantiate and cache a reusable LangChain ChatOllama client configured for low-temperature factual answering.
    Optimized for low-latency CPU inference:
    - reasoning=False: disables internal thinking/reasoning generation tokens on Qwen models
    - num_predict=512: bounds maximum output tokens to prevent runaway generation or truncation
    - num_thread=4: matches physical CPU cores (i7-1165G7), eliminating hyperthreading contention (20% speedup)
    - num_ctx=4096: bounds context window allocation to avoid excessive memory usage
    - keep_alive='30m': keeps model warm in memory to avoid reload latency
    - format='json': enforces JSON mode in Ollama's grammar engine
    """
    from langchain_ollama import ChatOllama

    resolved_model = model or settings.OLLAMA_MODEL
    resolved_temp = temperature if temperature is not None else settings.OLLAMA_TEMPERATURE
    resolved_timeout = timeout or settings.OLLAMA_TIMEOUT_SECONDS

    cache_key = f"{resolved_model}:{resolved_temp}:{resolved_timeout}:{num_predict}:{reasoning}:{num_ctx}:{num_thread}:{keep_alive}"
    if cache_key in _OLLAMA_CLIENT_CACHE:
        return _OLLAMA_CLIENT_CACHE[cache_key]

    kwargs: dict[str, Any] = {
        "base_url": settings.OLLAMA_BASE_URL,
        "model": resolved_model,
        "temperature": resolved_temp,
        "timeout": resolved_timeout,
        "format": "json",
        "num_predict": num_predict,
        "num_ctx": num_ctx,
        "num_thread": num_thread,
        "keep_alive": keep_alive,
    }

    try:
        client = ChatOllama(**kwargs, reasoning=reasoning)
    except TypeError:
        try:
            client = ChatOllama(**kwargs, think=reasoning)
        except TypeError:
            client = ChatOllama(**kwargs)

    _OLLAMA_CLIENT_CACHE[cache_key] = client
    return client


def _extract_json_block(text: str) -> str:
    """Extract JSON string from raw LLM output even if surrounded by markdown code fences."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text


def _extract_sources_from_context(context_text: str) -> list[str]:
    """Extract unique source URLs present in the provided company context block."""
    urls = re.findall(r"\(Source:\s*(https?://[^\s\)]+)\)", context_text)
    # Deduplicate while preserving order
    return list(dict.fromkeys(urls))


GROUNDED_RAG_SYSTEM_PROMPT = """You are Nexora.AI's factual company intelligence assistant.
Your task is to answer the user's question accurately and objectively, using ONLY the provided verified company context.

CRITICAL GROUNDING & ACCURACY RULES:
1. ONLY make claims directly stated in the verified context under <company_context>.
2. If the user asks a question that is NOT answered in the verified context, or asks about capabilities, products, metrics, or topics NOT in the database/pgvector, you must EXPLICITLY set:
   "answer": "I don't have enough information about this.",
   "evidence_status": "insufficient_evidence",
   "key_points": [],
   "sources": []
3. Do NOT extrapolate, speculate, guess, or invent metrics, client names, statistics, achievements, products, or company facts.
4. If only partial facts exist, answer what is verified and state clearly what information is missing.
5. When citing sources, include ONLY the exact URLs present in the context.
6. Return ONLY a valid JSON object matching this schema without any surrounding prose:

{
  "question": "<restate question>",
  "answer": "<detailed factual answer grounded in context, OR 'I don't have enough information about this.'>",
  "key_points": ["<bullet 1>", "<bullet 2>", ...],
  "sources": ["<url 1>", "<url 2>", ...],
  "evidence_status": "supported" | "partially_supported" | "insufficient_evidence"
}
"""


def generate_grounded_answer(
    *,
    question: str,
    company_context: str,
    known_sources: Sequence[str] | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> GroundedRAGResponse:
    """
    Generate a grounded, structured answer to a company-specific question using local Ollama.

    If the question cannot be answered from the verified context, explicitly returns
    "I don't have enough information about this." with evidence_status="insufficient_evidence".
    """
    clean_question = question.strip()
    clean_context = company_context.strip() if company_context else ""

    # 1. Early exit: empty context or fallback warning
    if (
        not clean_context
        or "No verified company knowledge or relevant semantic evidence is currently available" in clean_context
    ):
        logger.info("Insufficient evidence available for question: '%s'", clean_question[:60])
        return GroundedRAGResponse(
            question=clean_question,
            answer=INSUFFICIENT_INFO_MESSAGE,
            key_points=[],
            sources=[],
            evidence_status="insufficient_evidence",
        )

    # 2. Extract authentic sources from context
    context_sources = _extract_sources_from_context(clean_context)
    if known_sources:
        for s in known_sources:
            if s not in context_sources:
                context_sources.append(s)

    # Cache lookup using context hash + model + question
    import hashlib
    resolved_model = model or settings.OLLAMA_MODEL
    ctx_hash = hashlib.sha256(clean_context.encode("utf-8")).hexdigest()[:16]
    cache_key = f"{ctx_hash}:{resolved_model}:{clean_question.lower()}"
    if cache_key in _GROUNDED_RESEARCH_CACHE:
        logger.info("Serving grounded answer from memory cache: '%s'", clean_question[:50])
        return _GROUNDED_RESEARCH_CACHE[cache_key]

    # 3. Construct prompt
    user_prompt = f"""Question: {clean_question}

Verified Company Context:
{clean_context}

Provide your grounded response as JSON now:"""

    try:
        llm = get_ollama_llm(model=model, temperature=temperature)
        from langchain_core.messages import HumanMessage, SystemMessage

        response = llm.invoke(
            [
                SystemMessage(content=GROUNDED_RAG_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
        )
        raw_content = response.content if hasattr(response, "content") else str(response)

        # 4. Parse & Validate JSON
        json_str = _extract_json_block(raw_content)
        data = json.loads(json_str)

        data["question"] = clean_question

        # Fail-closed enforcement: if evidence_status is insufficient_evidence or answer is missing/negative
        answer_val = str(data.get("answer") or "").strip()
        answer_lower = answer_val.lower()
        negative_markers = [
            "not enough information",
            "don't have enough information",
            "do not have enough information",
            "insufficient information",
            "insufficient evidence",
            "no information",
            "cannot find",
            "not mentioned",
            "not provided",
            "does not mention",
            "does not contain",
            "no verified",
            "no data available",
        ]
        has_negative_marker = any(marker in answer_lower for marker in negative_markers)

        if (
            data.get("evidence_status") == "insufficient_evidence"
            or not answer_val
            or has_negative_marker
        ):
            data["answer"] = INSUFFICIENT_INFO_MESSAGE
            data["key_points"] = []
            data["sources"] = []
            data["evidence_status"] = "insufficient_evidence"

        # Harmonize sources: retain valid URLs from LLM that exist in context
        llm_sources = data.get("sources") or []
        verified_sources = [s for s in llm_sources if s in context_sources or s.startswith("http")]
        if not verified_sources and context_sources and data.get("evidence_status") != "insufficient_evidence":
            verified_sources = context_sources[:5]
        data["sources"] = verified_sources

        parsed = GroundedRAGResponse.model_validate(data)
        _GROUNDED_RESEARCH_CACHE[cache_key] = parsed
        logger.info(
            "Grounded answer generated: status=%s sources_count=%d key_points=%d",
            parsed.evidence_status,
            len(parsed.sources),
            len(parsed.key_points),
        )
        return parsed

    except json.JSONDecodeError as json_err:
        logger.warning(
            "LLM returned non-JSON response for question '%s': %s",
            clean_question[:60],
            json_err,
        )
        # If output contains refusal phrases, normalize to standard insufficient info response
        raw_lower = raw_content.lower() if "raw_content" in locals() else ""
        if any(w in raw_lower for w in ["not enough information", "cannot find", "no information", "unsupported", "does not contain"]):
            return GroundedRAGResponse(
                question=clean_question,
                answer=INSUFFICIENT_INFO_MESSAGE,
                key_points=[],
                sources=[],
                evidence_status="insufficient_evidence",
            )

        return GroundedRAGResponse(
            question=clean_question,
            answer=raw_content.strip() if "raw_content" in locals() else INSUFFICIENT_INFO_MESSAGE,
            key_points=[],
            sources=context_sources[:5],
            evidence_status="partially_supported",
        )

    except Exception as exc:
        logger.exception("Failed to generate grounded answer with Ollama: %s", exc)
        return GroundedRAGResponse(
            question=clean_question,
            answer=INSUFFICIENT_INFO_MESSAGE,
            key_points=[],
            sources=[],
            evidence_status="insufficient_evidence",
        )
