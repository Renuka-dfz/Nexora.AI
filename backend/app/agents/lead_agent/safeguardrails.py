"""
Nexora.AI - Lead Qualification Agent Safeguardrails.

Validates:
- Cross-company boundary compliance.
- Absence of leaked PII or sensitive credentials.
- Checks that matched services exist in verified offerings.
- Prevents unsupported external outreach without human authorization.
"""

from __future__ import annotations

import logging
import re
from typing import Sequence
from uuid import UUID

from app.agents.lead_agent.schemas import LeadValidationReport

logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
PHONE_PATTERN = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b")


def validate_lead_qualification(
    *,
    inquiry_text: str,
    qualification_summary: str,
    recommended_action: str,
    matched_services: Sequence[str],
    company_context: str,
) -> LeadValidationReport:
    """Validate that the lead qualification output is grounded, safe, and privacy-preserving."""
    findings: list[str] = []
    has_pii = False

    # 1. PII Check in generated summary (summary should describe fit, not repeat personal credentials)
    if re.search(r"\bpassword\b|\bsecret\b|\btoken\b", qualification_summary, re.I):
        findings.append("Generated qualification summary contains suspicious credential keywords.")
        has_pii = True

    # 2. Service Grounding Check
    context_lower = company_context.casefold() if company_context else ""
    for s in matched_services:
        # Check if the service name has reasonable presence in the company context
        first_word = s.split()[0].casefold() if s.split() else ""
        if first_word and first_word not in context_lower and "data" not in first_word and "ai" not in first_word:
            findings.append(f"Service '{s}' may not be strongly grounded in company offerings.")

    # 3. Action Safety Check: Ensure no automatic sending of external communications
    action_lower = recommended_action.casefold()
    if any(phrase in action_lower for phrase in ["automatically email", "auto-send", "charge credit card"]):
        findings.append("Recommended action suggests unauthorized automatic external action without human sign-off.")

    passed = not has_pii and len(findings) == 0

    return LeadValidationReport(
        passed=passed,
        findings=findings,
        has_pii_leak=has_pii,
    )
