
"""Cross-Encoder reranking for Nexora.AI RAG."""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Sequence

from sentence_transformers import CrossEncoder

from app.rag.retrieval import (
    RetrievedEvidence,
)


logger = logging.getLogger(__name__)

RERANKER_MODEL = (
    "cross-encoder/ms-marco-MiniLM-L6-v2"
)

MAX_RERANK_CANDIDATES = 30


@dataclass(frozen=True)
class RankedEvidence:
    evidence: RetrievedEvidence
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


def rerank_evidence(
    *,
    query: str,
    candidates: Sequence[RetrievedEvidence],
    top_k: int = 5,
) -> list[RankedEvidence]:
    """
    Score query/document pairs with a Cross-Encoder.

    Higher scores mean higher predicted relevance.

    Cross-Encoder scores are not calibrated
    probabilities of factual correctness.
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

    # Include heading context to improve relevance.
    passages = [
        (
            f"{item.heading_path}\n"
            f"{item.content}"
        )
        for item in candidates
    ]

    pairs = [
        (query.strip(), passage)
        for passage in passages
    ]

    model = get_reranker()

    try:
        raw_scores = model.predict(
            pairs,
            batch_size=16,
            show_progress_bar=False,
        )

    except Exception as exc:
        logger.exception(
            "RAG Cross-Encoder reranking failed."
        )

        # Fail closed rather than silently claiming
        # the original ranking was reranker-verified.
        raise RuntimeError(
            "Unable to rerank retrieval results."
        ) from exc

    if len(raw_scores) != len(candidates):
        raise RuntimeError(
            "Reranker returned an unexpected "
            "number of scores."
        )

    scored: list[tuple[RetrievedEvidence, float]] = []

    for evidence, raw_score in zip(
        candidates,
        raw_scores,
        strict=True,
    ):
        score = float(raw_score)

        if not math.isfinite(score):
            raise RuntimeError(
                "Reranker returned an invalid score."
            )

        scored.append(
            (evidence, score)
        )

    scored.sort(
        key=lambda item: (
            -item[1],
            -item[0].rrf_score,
            str(item[0].chunk_id),
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
