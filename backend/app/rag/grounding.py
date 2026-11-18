
"""Claim-level grounding checks for Nexora.AI RAG.

Checks exact evidence quotations and direct factual support.
Paraphrases remain unverified until reviewed.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Mapping, Sequence

from app.rag.retrieval import (
    RetrievedEvidence,
)


@dataclass(frozen=True)
class FactualClaim:
    text: str
    evidence_ids: tuple[str, ...]
    supporting_quotes: tuple[str, ...]


@dataclass(frozen=True)
class ClaimCheck:
    claim: str
    supported: bool
    reasons: tuple[str, ...]
    evidence_ids: tuple[str, ...]


@dataclass(frozen=True)
class GroundingReport:
    passed: bool
    claims: tuple[ClaimCheck, ...]
    unsupported_claims: int
    support_rate: float


def normalize_for_matching(text: str) -> str:
    """Normalize whitespace and Unicode for text comparison."""

    normalized = unicodedata.normalize(
        "NFKC",
        text,
    )

    return re.sub(
        r"\s+",
        " ",
        normalized,
    ).strip().casefold()


def build_evidence_map(
    evidence: Sequence[RetrievedEvidence],
) -> dict[str, RetrievedEvidence]:
    """Use actual retrieved chunk IDs as evidence keys."""

    return {
        str(item.chunk_id): item
        for item in evidence
    }


def check_claim(
    claim: FactualClaim,
    *,
    evidence_map: Mapping[str, RetrievedEvidence],
) -> ClaimCheck:
    reasons: list[str] = []

    claim_text = normalize_for_matching(
        claim.text
    )

    if not claim_text:
        reasons.append("empty_claim")

    if not claim.evidence_ids:
        reasons.append("missing_evidence_ids")

    if (
        not claim.supporting_quotes
        or len(claim.supporting_quotes)
        != len(claim.evidence_ids)
    ):
        reasons.append("missing_or_misaligned_quotes")

    found_quotes: list[str] = []

    for index, evidence_id in enumerate(
        claim.evidence_ids
    ):
        passage = evidence_map.get(evidence_id)

        if passage is None:
            reasons.append(
                f"unknown_evidence_id:{evidence_id}"
            )
            continue

        if index >= len(claim.supporting_quotes):
            continue

        quote = normalize_for_matching(
            claim.supporting_quotes[index]
        )

        passage_text = normalize_for_matching(
            passage.content
        )

        if not quote:
            reasons.append("empty_supporting_quote")
            continue

        if quote not in passage_text:
            reasons.append(
                f"quote_not_found:{evidence_id}"
            )
            continue

        found_quotes.append(quote)

    # Direct-match auto-approval only.
    #
    # A valid quote existing in a document does not
    # automatically prove a different paraphrased claim.
    if claim_text and found_quotes:
        directly_supported = any(
            claim_text in quote
            for quote in found_quotes
        )

        if not directly_supported:
            reasons.append(
                "semantic_entailment_not_verified"
            )

    elif claim_text:
        reasons.append("no_valid_supporting_quote")

    unique_reasons = tuple(
        dict.fromkeys(reasons)
    )

    return ClaimCheck(
        claim=claim.text,
        supported=not unique_reasons,
        reasons=unique_reasons,
        evidence_ids=claim.evidence_ids,
    )


def verify_claims(
    *,
    claims: Sequence[FactualClaim],
    evidence: Sequence[RetrievedEvidence],
) -> GroundingReport:
    """
    Check every generated factual claim.

    Empty claim sets fail closed; a generated answer
    should not bypass grounding by omitting claims.
    """

    if not claims:
        return GroundingReport(
            passed=False,
            claims=(),
            unsupported_claims=0,
            support_rate=0.0,
        )

    evidence_map = build_evidence_map(
        evidence
    )

    checks = tuple(
        check_claim(
            claim,
            evidence_map=evidence_map,
        )
        for claim in claims
    )

    supported_count = sum(
        check.supported
        for check in checks
    )

    unsupported_count = (
        len(checks) - supported_count
    )

    return GroundingReport(
        passed=unsupported_count == 0,
        claims=checks,
        unsupported_claims=unsupported_count,
        support_rate=(
            supported_count / len(checks)
        ),
    )
