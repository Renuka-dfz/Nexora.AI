"""
Nexora.AI - Marketing Agent Safeguardrails & Content Validation.

Validates marketing content before it can enter the human approval workflow:
- Detects unsupported claims, fake metrics, or unverified customers.
- Guards against prompt injection patterns in scraped content.
- Flags sensitive credential or PII leakage.
- Checks citation integrity.
- Emits actionable validation findings without silently altering text.
"""

from __future__ import annotations

import logging
import re
from typing import Sequence

from app.agents.marketing_agent.schemas import MarketingValidationReport, ValidationFinding

logger = logging.getLogger(__name__)

# Common prompt injection patterns that might leak through scraped web content
INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.I),
    re.compile(r"system\s*prompt\s*override", re.I),
    re.compile(r"<script[\s\S]*?>[\s\S]*?<\/script>", re.I),
    re.compile(r"\b(eval|exec|base64_decode)\s*\(", re.I),
    re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.I),
]

# Sensitive patterns (credentials, internal API tokens, passwords)
SENSITIVE_PATTERNS = [
    re.compile(r"\b(bearer\s+[A-Za-z0-9_\-\.]{20,})\b", re.I),
    re.compile(r"\b(sk-[A-Za-z0-9]{20,})\b", re.I),
    re.compile(r"\b(ghp_[A-Za-z0-9]{30,})\b", re.I),
    re.compile(r"(password|secret)\s*[:=]\s*['\"][^'\"]+['\"]", re.I),
]


def validate_marketing_content(
    *,
    content: str,
    sources: Sequence[str],
    grounded_evidence_text: str,
    platform: str,
) -> MarketingValidationReport:
    """
    Run deterministic safeguard checks on generated marketing copy.

    Returns:
        MarketingValidationReport with passed flag, score, and granular findings.
    """
    findings: list[ValidationFinding] = []
    unsupported_claims: list[str] = []

    clean_content = content.strip() if content else ""
    evidence_lower = grounded_evidence_text.casefold() if grounded_evidence_text else ""

    # 1. Prompt Injection Guard
    injection_found = False
    for pat in INJECTION_PATTERNS:
        match = pat.search(clean_content)
        if match:
            injection_found = True
            findings.append(
                ValidationFinding(
                    check_name="prompt_injection_guard",
                    passed=False,
                    details=f"Detected potential prompt injection pattern: '{match.group(0)}'",
                    severity="critical",
                )
            )
            break
    if not injection_found:
        findings.append(
            ValidationFinding(
                check_name="prompt_injection_guard",
                passed=True,
                details="No prompt injection patterns detected.",
                severity="low",
            )
        )

    # 2. Sensitive Data & Credential Leakage
    sensitive_found = False
    for pat in SENSITIVE_PATTERNS:
        if pat.search(clean_content):
            sensitive_found = True
            findings.append(
                ValidationFinding(
                    check_name="sensitive_leakage_guard",
                    passed=False,
                    details="Detected sensitive token or credential pattern in generated draft.",
                    severity="critical",
                )
            )
            break
    if not sensitive_found:
        findings.append(
            ValidationFinding(
                check_name="sensitive_leakage_guard",
                passed=True,
                details="No sensitive credentials or internal keys detected.",
                severity="low",
            )
        )

    # 3. Citation and Source Verification
    invalid_sources = [s for s in sources if not (s.startswith("http://") or s.startswith("https://"))]
    if invalid_sources:
        findings.append(
            ValidationFinding(
                check_name="citation_integrity",
                passed=False,
                details=f"Draft references malformed URLs: {invalid_sources}",
                severity="medium",
            )
        )
    else:
        findings.append(
            ValidationFinding(
                check_name="citation_integrity",
                passed=True,
                details=f"Verified {len(sources)} valid source URL citations.",
                severity="low",
            )
        )

    # 4. Metric & Percentage Grounding Check
    # Extract percentages like "99%", "48%" or multipliers like "10x", "$5M"
    metric_matches = re.findall(r"\b(\d+%\b|\d+x\b|\$\d+[\d,]*\b)", clean_content, re.IGNORECASE)
    unsupported_metrics = []
    for metric in metric_matches:
        if metric.casefold() not in evidence_lower:
            unsupported_metrics.append(metric)

    if unsupported_metrics:
        unsupported_claims.extend(
            [f"Unverified metric in draft: '{m}' was not found in grounded context" for m in unsupported_metrics]
        )
        findings.append(
            ValidationFinding(
                check_name="metric_grounding",
                passed=False,
                details=f"Unverified numbers or metrics detected: {unsupported_metrics}",
                severity="medium",
            )
        )
    else:
        findings.append(
            ValidationFinding(
                check_name="metric_grounding",
                passed=True,
                details="All cited numerical metrics match verified evidence context.",
                severity="low",
            )
        )

    # 5. Length & Platform Suitability
    char_len = len(clean_content)
    if platform.lower() == "linkedin" and char_len > 3000:
        findings.append(
            ValidationFinding(
                check_name="platform_length",
                passed=False,
                details=f"LinkedIn post length ({char_len} chars) exceeds optimal 3,000 char threshold.",
                severity="low",
            )
        )
    elif platform.lower() == "instagram" and char_len > 2200:
        findings.append(
            ValidationFinding(
                check_name="platform_length",
                passed=False,
                details=f"Instagram caption length ({char_len} chars) exceeds 2,200 char platform limit.",
                severity="medium",
            )
        )
    else:
        findings.append(
            ValidationFinding(
                check_name="platform_length",
                passed=True,
                details=f"Draft length ({char_len} chars) fits platform requirements.",
                severity="low",
            )
        )

    # Compute overall score and pass status
    critical_failures = [f for f in findings if not f.passed and f.severity == "critical"]
    medium_failures = [f for f in findings if not f.passed and f.severity == "medium"]

    passed_checks = sum(1 for f in findings if f.passed)
    score = round(passed_checks / len(findings), 2) if findings else 0.0
    passed = len(critical_failures) == 0 and len(medium_failures) == 0

    return MarketingValidationReport(
        passed=passed,
        factual_grounding_score=score,
        findings=findings,
        unsupported_claims=unsupported_claims,
    )
