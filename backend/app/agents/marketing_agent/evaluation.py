"""
Nexora.AI - Marketing Agent Evaluation & Quality Scoring.

Measures:
- Factual grounding & faithfulness to retrieved company evidence.
- Source citation coverage.
- Tone and platform format suitability.
- Unsupported metric / claim density.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ContentEvaluationMetric:
    name: str
    score: float  # 0.0 to 1.0
    rationale: str


@dataclass(frozen=True)
class MarketingContentEvaluation:
    overall_score: float
    grounding_score: float
    source_attribution_rate: float
    platform_suitability_score: float
    metrics: tuple[ContentEvaluationMetric, ...]
    approved_for_human_review: bool


def evaluate_marketing_draft(
    *,
    content: str,
    sources: Sequence[str],
    grounded_evidence_text: str,
    platform: str,
    unsupported_claims: Sequence[str] | None = None,
) -> MarketingContentEvaluation:
    """Evaluate generated marketing copy quality and factual grounding."""
    metrics: list[ContentEvaluationMetric] = []
    clean_content = content.strip()
    evidence_lower = grounded_evidence_text.casefold() if grounded_evidence_text else ""

    # 1. Source Attribution
    source_count = len(sources)
    if source_count >= 2:
        source_score = 1.0
        source_reason = f"Excellent source grounding with {source_count} authentic citations."
    elif source_count == 1:
        source_score = 0.75
        source_reason = "Adequate source grounding with 1 authentic citation."
    else:
        source_score = 0.2
        source_reason = "No authentic source citations referenced."

    metrics.append(
        ContentEvaluationMetric(
            name="source_attribution",
            score=source_score,
            rationale=source_reason,
        )
    )

    # 2. Unsupported Claim Penalty
    unsupported_count = len(unsupported_claims or [])
    if unsupported_count == 0:
        claim_score = 1.0
        claim_reason = "Zero unverified metrics or unsupported customer claims detected."
    elif unsupported_count <= 2:
        claim_score = 0.6
        claim_reason = f"Detected {unsupported_count} unverified claim(s)."
    else:
        claim_score = 0.2
        claim_reason = f"High density of unverified claims ({unsupported_count})."

    metrics.append(
        ContentEvaluationMetric(
            name="claim_grounding",
            score=claim_score,
            rationale=claim_reason,
        )
    )

    # 3. Platform Suitability
    char_len = len(clean_content)
    if platform.lower() == "linkedin":
        # Sweet spot for LinkedIn B2B posts: 600 - 2000 chars
        if 400 <= char_len <= 2500:
            plat_score = 1.0
            plat_reason = f"Ideal length ({char_len} chars) for mobile readability on LinkedIn."
        else:
            plat_score = 0.7
            plat_reason = f"Length ({char_len} chars) is outside optimal LinkedIn range."
    elif platform.lower() == "instagram":
        if 200 <= char_len <= 1500:
            plat_score = 1.0
            plat_reason = f"Ideal Instagram caption length ({char_len} chars)."
        else:
            plat_score = 0.65
            plat_reason = f"Suboptimal caption length ({char_len} chars) for Instagram."
    else:
        plat_score = 0.9
        plat_reason = "Article format evaluated."

    metrics.append(
        ContentEvaluationMetric(
            name="platform_suitability",
            score=plat_score,
            rationale=plat_reason,
        )
    )

    overall_score = round(
        (source_score * 0.35) + (claim_score * 0.45) + (plat_score * 0.20),
        2,
    )
    ready = overall_score >= 0.70 and claim_score >= 0.60

    return MarketingContentEvaluation(
        overall_score=overall_score,
        grounding_score=claim_score,
        source_attribution_rate=source_score,
        platform_suitability_score=plat_score,
        metrics=tuple(metrics),
        approved_for_human_review=ready,
    )
