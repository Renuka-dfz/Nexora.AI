"""
Nexora.AI - Lead Qualification Agent Pydantic Schemas & API Contracts.
"""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

IntentLevel = Literal["unknown", "low", "medium", "high"]
QualificationStatus = Literal["pending", "qualified", "nurture", "unqualified"]


class LeadIntakeRequest(BaseModel):
    """Initial payload to evaluate an inbound prospective customer."""
    company_id: UUID
    lead_id: UUID | None = None
    full_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=255)
    organization: str | None = Field(default=None, max_length=200)
    inquiry_text: str = Field(min_length=5, max_length=5000)
    source_name: str | None = Field(default="Website Contact Form", max_length=100)


class ServiceMatchResult(BaseModel):
    """Specific company service or solution identified as a fit for the lead."""
    service_name: str
    category: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class LeadEvaluationOutput(BaseModel):
    """Structured qualification assessment and recommendation."""
    model_config = ConfigDict(from_attributes=True)

    lead_id: UUID | None = None
    lead_score: int = Field(ge=0, le=100)
    intent_level: IntentLevel
    qualification_status: QualificationStatus
    matched_services: list[ServiceMatchResult] = Field(default_factory=list)
    qualification_summary: str
    recommended_action: str
    confidence_score: float = Field(ge=0.0, le=1.0)


class LeadValidationReport(BaseModel):
    """Safety and hallucination check report on lead evaluation."""
    passed: bool
    findings: list[str] = Field(default_factory=list)
    has_pii_leak: bool = False


class LeadHumanReviewDecision(BaseModel):
    """Human-in-the-loop review of an AI lead qualification recommendation."""
    lead_id: UUID
    qualification_id: UUID | None = None
    approved_status: QualificationStatus
    notes: str | None = None
    reviewed_by: UUID
