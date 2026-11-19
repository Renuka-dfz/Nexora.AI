"""Cross-Encoder reranking for Nexora.AI RAG."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING, Sequence

from sentence_transformers import CrossEncoder

if TYPE_CHECKING:
    from app.rag.retrieval import RetrievedEvidence


logger = logging.getLogger(__name__)

RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L6-v2"
MAX_RERANK_CANDIDATES = 30


@dataclass(frozen=True)
class RankedEvidence:
    """Reranked evidence item with raw Cross-Encoder logit score."""
    evidence: Any
    rerank_score: float
    rerank_position: int


@lru_cache(maxsize=1)
def get_reranker() -> CrossEncoder:
    """Load one reusable local Cross-Encoder."""
    return CrossEncoder(
        RERANKER_MODEL,
        device="cpu",
        max_length=512,
    )


def _format_candidate_passage(item: Any) -> str:
    """
    Format candidate chunk passage with company name, category, and heading context.
    
    Enriching the passage prevents semantic confusion between generic company overview
    content (e.g. leadership bios) and anonymized case studies or client success metrics.
    """
    prefix_parts: list[str] = []

    company_name = getattr(item, "company_name", None)
    if company_name and str(company_name).strip():
        prefix_parts.append(f"[Company: {str(company_name).strip()}]")

    category_name = getattr(item, "category_name", None)
    if category_name and str(category_name).strip():
        prefix_parts.append(f"[Category: {str(category_name).strip()}]")

    context_prefix = " ".join(prefix_parts)

    sections: list[str] = []
    if context_prefix:
        sections.append(context_prefix)

    heading_path = getattr(item, "heading_path", "")
    if heading_path and str(heading_path).strip():
        sections.append(str(heading_path).strip())

    content = getattr(item, "content", "")
    if content and str(content).strip():
        sections.append(str(content).strip())

    return "\n".join(sections)


def rerank_evidence(
    *,
    query: str,
    candidates: Sequence[Any],
    top_k: int = 5,
    min_score: float | None = None,
) -> list[RankedEvidence]:
    """
    Score query/document pairs with a local Cross-Encoder (ms-marco-MiniLM-L6-v2).

    Higher scores indicate higher predicted relevance.
    NOTE: Cross-Encoder scores are uncalibrated raw logits (-11 to +11),
    NOT calibrated probabilities of factual correctness.
    """
    if not isinstance(query, str) or not query.strip():
        raise ValueError("Query cannot be empty.")

    if top_k <= 0:
        raise ValueError("top_k must be positive.")

    if not candidates:
        return []

    if len(candidates) > MAX_RERANK_CANDIDATES:
        raise ValueError(
            f"At most {MAX_RERANK_CANDIDATES} "
            "candidates are supported per reranking call."
        )

    # Format enriched passages with company, category, heading, and content
    passages = [_format_candidate_passage(item) for item in candidates]

    pairs = [(query.strip(), passage) for passage in passages]

    model = get_reranker()

    try:
        raw_scores = model.predict(
            pairs,
            batch_size=16,
            show_progress_bar=False,
        )
    except Exception as exc:
        logger.exception("RAG Cross-Encoder reranking failed.")
        # Fail closed rather than silently claiming the original ranking was reranker-verified.
        raise RuntimeError("Unable to rerank retrieval results.") from exc

    if len(raw_scores) != len(candidates):
        raise RuntimeError("Reranker returned an unexpected number of scores.")

    scored: list[tuple[Any, float]] = []

    for evidence, raw_score in zip(candidates, raw_scores, strict=True):
        score = float(raw_score)

        if not math.isfinite(score):
            raise RuntimeError("Reranker returned an invalid score.")

        if min_score is not None and score < min_score:
            continue

        scored.append((evidence, score))

    scored.sort(
        key=lambda item: (
            -item[1],
            -getattr(item[0], "rrf_score", 0.0),
            str(getattr(item[0], "chunk_id", "")),
        )
    )

    return [
        RankedEvidence(
            evidence=evidence,
            rerank_score=score,
            rerank_position=position,
        )
        for position, (evidence, score) in enumerate(
            scored[:top_k],
            start=1,
        )
    ]
