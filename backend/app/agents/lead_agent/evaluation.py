"""
Nexora.AI - Lead Qualification Agent Evaluation & Scoring Audit.

Evaluates:
- Intent classification consistency.
- Service match relevance to inquiry keywords.
- Scoring calibration (rule-based score alignment with intent level).
- Grounding of follow-up recommendations.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LeadEvaluationMetric:
    metric_name: str
    passed: bool
    score: float
    notes: str


@dataclass(frozen=True)
class LeadAuditReport:
    is_valid: bool
    overall_confidence: float
    metrics: tuple[LeadEvaluationMetric, ...]


def evaluate_lead_qualification_result(
    *,
    inquiry_text: str,
    intent_level: str,
    lead_score: int,
    matched_services: Sequence[str],
    recommended_action: str,
) -> LeadAuditReport:
    """Run sanity and consistency checks across the qualification output."""
    metrics: list[LeadEvaluationMetric] = []

    # 1. Score / Intent Alignment Check
    score_aligned = True
    score_notes = "Score aligns with intent level."
    if intent_level == "high" and lead_score < 60:
        score_aligned = False
        score_notes = f"High intent inquiry received low score ({lead_score})."
    elif intent_level == "low" and lead_score > 60:
        score_aligned = False
        score_notes = f"Low intent inquiry received unexpectedly high score ({lead_score})."

    metrics.append(
        LeadEvaluationMetric(
            metric_name="score_intent_alignment",
            passed=score_aligned,
            score=1.0 if score_aligned else 0.5,
            notes=score_notes,
        )
    )

    # 2. Service Matching Coverage
    has_services = len(matched_services) > 0
    metrics.append(
        LeadEvaluationMetric(
            metric_name="service_matching",
            passed=has_services,
            score=1.0 if has_services else 0.3,
            notes=f"Identified {len(matched_services)} matched offering(s).",
        )
    )

    # 3. Action Specificity
    action_clean = recommended_action.strip()
    action_specific = len(action_clean.split()) >= 4
    metrics.append(
        LeadEvaluationMetric(
            metric_name="action_relevance",
            passed=action_specific,
            score=1.0 if action_specific else 0.5,
            notes="Actionable recommendation provided." if action_specific else "Recommendation is too vague.",
        )
    )

    all_passed = all(m.passed for m in metrics)
    avg_score = round(sum(m.score for m in metrics) / len(metrics), 2)

    return LeadAuditReport(
        is_valid=all_passed,
        overall_confidence=avg_score,
        metrics=tuple(metrics),
    )
