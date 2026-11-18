
"""Fail-closed evidence gate for Nexora.AI RAG."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from sqlalchemy.orm import Session

from app.rag.retrieval import (
    RetrievedEvidence,
)
from app.rag.reranking import (
    RankedEvidence,
)
from app.rag.source_verification import (
    verify_retrieved_sources,
)
from app.rag.grounding import (
    FactualClaim,
    GroundingReport,
    verify_claims,
)


INSUFFICIENT_EVIDENCE_MESSAGE = (
    "I could not find enough verified company "
    "information to support this answer."
)

UNSUPPORTED_CLAIM_MESSAGE = (
    "The generated content contains claims that "
    "could not be verified against the available evidence."
)


@dataclass(frozen=True)
class EvidenceGateResult:
    allowed: bool
    evidence: tuple[RetrievedEvidence, ...]
    rejected_chunks: tuple[str, ...]
    reason: str | None = None


@dataclass(frozen=True)
class GroundedDraftDecision:
    approved_for_review: bool
    message: str
    report: GroundingReport | None


def filter_verified_evidence(
    *,
    db: Session,
    company_id: Any,
    ranked_results: Sequence[RankedEvidence],
    min_evidence: int = 1,
) -> EvidenceGateResult:
    """
    Only retain chunks that pass database-backed
    source-integrity and verification checks.
    """

    if min_evidence < 1:
        raise ValueError(
            "min_evidence must be positive."
        )

    if not ranked_results:
        return EvidenceGateResult(
            allowed=False,
            evidence=(),
            rejected_chunks=(),
            reason=INSUFFICIENT_EVIDENCE_MESSAGE,
        )

    # Prevent duplicate chunk IDs.
    unique: dict[str, RetrievedEvidence] = {}

    for result in ranked_results:
        item = result.evidence
        unique.setdefault(
            str(item.chunk_id),
            item,
        )

    checks = verify_retrieved_sources(
        db=db,
        company_id=company_id,
        chunk_ids=[
            item.chunk_id
            for item in unique.values()
        ],
    )

    accepted: list[RetrievedEvidence] = []
    rejected: list[str] = []

    for item in unique.values():
        check = checks[item.chunk_id]

        if check.eligible:
            accepted.append(item)
        else:
            rejected.append(
                str(item.chunk_id)
            )

    return EvidenceGateResult(
        allowed=len(accepted) >= min_evidence,
        evidence=tuple(accepted),
        rejected_chunks=tuple(rejected),
        reason=(
            None
            if len(accepted) >= min_evidence
            else INSUFFICIENT_EVIDENCE_MESSAGE
        ),
    )


def evaluate_grounded_draft(
    *,
    generated_text: str,
    claims: Sequence[FactualClaim],
    approved_evidence: Sequence[RetrievedEvidence],
    claim_coverage_verified: bool = False,
) -> GroundedDraftDecision:
    """
    Determine whether a draft can proceed to human review.

    claim_coverage_verified must be established by an
    independent validation step that confirms all factual
    claims in generated_text were supplied for checking.

    Never set it to True merely because the LLM says so.
    """

    if not generated_text.strip():
        return GroundedDraftDecision(
            approved_for_review=False,
            message="Generated content is empty.",
            report=None,
        )

    if not approved_evidence:
        return GroundedDraftDecision(
            approved_for_review=False,
            message=INSUFFICIENT_EVIDENCE_MESSAGE,
            report=None,
        )

    if not claim_coverage_verified:
        return GroundedDraftDecision(
            approved_for_review=False,
            message=(
                "Complete factual-claim coverage "
                "has not been independently verified."
            ),
            report=None,
        )

    report = verify_claims(
        claims=claims,
        evidence=approved_evidence,
    )

    if not report.passed:
        return GroundedDraftDecision(
            approved_for_review=False,
            message=UNSUPPORTED_CLAIM_MESSAGE,
            report=report,
        )

    return GroundedDraftDecision(
        approved_for_review=True,
        message=(
            "Direct evidence checks passed. "
            "Human approval is still required."
        ),
        report=report,
    )
