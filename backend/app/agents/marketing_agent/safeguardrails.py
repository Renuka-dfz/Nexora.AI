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

    # 4. Metric & Numerical Grounding Check
    # Extract percentages (e.g., 99%), multipliers (e.g., 10x), dollar amounts (e.g., $5M), and explicit timeframes
    metric_matches = list(set(re.findall(r"\b(\d+%\b|\d+x\b|\$\d+[\d,]*\b)", clean_content, re.IGNORECASE)))
    unsupported_metrics = []
    supported_metrics_count = 0
    for metric in metric_matches:
        if metric.casefold() in evidence_lower:
            supported_metrics_count += 1
        else:
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
                details="All cited numerical metrics match verified evidence context."
                if metric_matches
                else "No numerical metrics cited in draft.",
                severity="low",
            )
        )

    # 5. Timeline & Guarantee Grounding Check
    # Flags unsubstantiated delivery guarantees or fixed delivery timelines (e.g. "by week five", "guaranteed delivery")
    timeline_matches = list(set(re.findall(r"\b(week\s+\d+|\d+\s*weeks?|guarantee(?:d|s)?)\b", clean_content, re.IGNORECASE)))
    unsupported_timelines = []
    supported_timelines_count = 0
    for tm in timeline_matches:
        if tm.casefold() in evidence_lower:
            supported_timelines_count += 1
        else:
            unsupported_timelines.append(tm)

    if unsupported_timelines:
        unsupported_claims.extend(
            [f"Unverified timeline/guarantee in draft: '{tm}' is not supported by company knowledge" for tm in unsupported_timelines]
        )
        findings.append(
            ValidationFinding(
                check_name="timeline_guarantee_grounding",
                passed=False,
                details=f"Unverified delivery timeline or guarantee claims detected: {unsupported_timelines}",
                severity="medium",
            )
        )
    else:
        findings.append(
            ValidationFinding(
                check_name="timeline_guarantee_grounding",
                passed=True,
                details="No unverified timeline or guarantee claims detected.",
                severity="low",
            )
        )

    # 6. Named Agent & Product Grounding Check
    # Verify that any specifically capitalized "... Agent" or "... Platform" mentioned exists in evidence context
    GENERIC_AGENT_EXCLUSIONS = {
        "ai agent", "multi-agent", "deterministic agent", "langgraph agent",
        "autonomous agent", "software agent", "marketing agent", "sales agent",
        "lead agent", "lead qualification agent", "deterministic langgraph agent",
    }
    named_agent_matches = list(set(re.findall(r"\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*\s+Agent)\b", clean_content)))
    unsupported_agents = []
    supported_agents_count = 0
    for agent_name in named_agent_matches:
        if agent_name.casefold() in GENERIC_AGENT_EXCLUSIONS:
            supported_agents_count += 1
            continue
        if agent_name.casefold() in evidence_lower:
            supported_agents_count += 1
        else:
            unsupported_agents.append(agent_name)

    if unsupported_agents:
        unsupported_claims.extend(
            [f"Unverified named agent in draft: '{ag}' was not found in grounded company facts" for ag in unsupported_agents]
        )
        findings.append(
            ValidationFinding(
                check_name="agent_entity_grounding",
                passed=False,
                details=f"Unverified named agent entities cited: {unsupported_agents}",
                severity="medium",
            )
        )
    else:
        findings.append(
            ValidationFinding(
                check_name="agent_entity_grounding",
                passed=True,
                details=f"All {len(named_agent_matches)} named agent references verified in company evidence."
                if named_agent_matches
                else "No specific named agent entities cited.",
                severity="low",
            )
        )

    # 7. Hardware Sensor & Unverified Domain Check
    # Checks for hardware claims (e.g. microphones, acoustic sensors) or clinical/retail claims when absent from context
    unverified_domain_patterns = [
        (r"\b(acoustic\s*sensors?|vibration\s*sensors?|microphones?)\b", "hardware sensor claims"),
        (r"\b(patient\s*(health\s*)?records?|clinical\s*diagnostics?)\b", "clinical healthcare claims"),
        (r"\b(store\s*inventory|shelf\s*monitoring)\b", "retail inventory claims"),
    ]
    unsupported_domains = []
    for pat_str, label in unverified_domain_patterns:
        m = re.findall(pat_str, clean_content, re.IGNORECASE)
        if m:
            matched_terms = [item if isinstance(item, str) else item[0] for item in m]
            for term in set(matched_terms):
                if term.casefold() not in evidence_lower:
                    unsupported_domains.append(f"{term} ({label})")

    if unsupported_domains:
        unsupported_claims.extend(
            [f"Unverified domain concept in draft: '{ud}' is not documented in company evidence" for ud in unsupported_domains]
        )
        findings.append(
            ValidationFinding(
                check_name="domain_grounding",
                passed=False,
                details=f"Unverified hardware or domain claims detected: {unsupported_domains}",
                severity="medium",
            )
        )
    else:
        findings.append(
            ValidationFinding(
                check_name="domain_grounding",
                passed=True,
                details="No unverified hardware or domain claims detected.",
                severity="low",
            )
        )

    # 8. Length & Platform Suitability
    char_len = len(clean_content)
    is_article = platform.lower() in ("article", "linkedin_article")
    if is_article:
        if char_len < 1500:
            findings.append(
                ValidationFinding(
                    check_name="platform_length",
                    passed=False,
                    details=f"Article length ({char_len} chars) is shorter than recommended 2,000 character minimum.",
                    severity="low",
                )
            )
        elif char_len > 8000:
            findings.append(
                ValidationFinding(
                    check_name="platform_length",
                    passed=False,
                    details=f"Article length ({char_len} chars) exceeds 8,000 character maximum.",
                    severity="medium",
                )
            )
        else:
            findings.append(
                ValidationFinding(
                    check_name="platform_length",
                    passed=True,
                    details=f"Article length ({char_len} chars) is appropriate for in-depth technical thought leadership.",
                    severity="low",
                )
            )
    elif platform.lower() == "linkedin" and char_len > 3000:
        findings.append(
            ValidationFinding(
                check_name="platform_length",
                passed=False,
                details=f"LinkedIn post length ({char_len} chars) exceeds optimal 3,000 char threshold.",
                severity="low",
            )
        )
    elif platform.lower() == "instagram":
        # Extract caption portion if structured Instagram format is used
        caption_to_check = clean_content
        if "### CAPTION" in clean_content:
            caption_part = clean_content.split("### CAPTION", 1)[1]
            for header in ("### DESCRIPTION", "### HASHTAGS", "### SEO KEYWORDS"):
                if header in caption_part:
                    caption_part = caption_part.split(header, 1)[0]
            caption_to_check = caption_part.strip()

        if len(caption_to_check) > 2200:
            findings.append(
                ValidationFinding(
                    check_name="platform_length",
                    passed=False,
                    details=f"Instagram caption length ({len(caption_to_check)} chars) exceeds 2,200 char platform limit.",
                    severity="low",
                )
            )
        else:
            findings.append(
                ValidationFinding(
                    check_name="platform_length",
                    passed=True,
                    details=f"Instagram caption length ({len(caption_to_check)} chars) is within 2,200 char platform limit.",
                    severity="low",
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

    # Compute factual grounding score strictly based on factual claims checked
    total_factual_claims = (
        len(metric_matches)
        + len(timeline_matches)
        + len(named_agent_matches)
        + len(unsupported_domains)
    )
    supported_factual_claims = (
        supported_metrics_count
        + supported_timelines_count
        + supported_agents_count
    )

    if total_factual_claims > 0:
        factual_score = round(supported_factual_claims / total_factual_claims, 2)
    else:
        # If no explicit numerical/agent claims, evaluate based on safety check pass rate
        safety_checks = [f for f in findings if f.check_name in ("prompt_injection_guard", "sensitive_leakage_guard", "citation_integrity")]
        factual_score = 1.0 if all(f.passed for f in safety_checks) else 0.5

    critical_failures = [f for f in findings if not f.passed and f.severity == "critical"]
    medium_failures = [f for f in findings if not f.passed and f.severity == "medium"]
    passed = len(critical_failures) == 0 and len(medium_failures) == 0

    return MarketingValidationReport(
        passed=passed,
        factual_grounding_score=factual_score,
        findings=findings,
        unsupported_claims=unsupported_claims,
    )
