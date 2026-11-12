
"""
Nexora.AI - Lead Management API Schemas

Pydantic v2 request and response schemas for:
- Lead Profiles
- Lead Sources
- Lead Qualification
- Qualification History

No AI scoring or database operations.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


# =====================================================
# SHARED CONFIGURATION
# =====================================================

class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


LeadStatus = Literal[
    "active",
    "inactive",
    "converted",
]

IntentLevel = Literal[
    "unknown",
    "low",
    "medium",
    "high",
]

QualificationStatus = Literal[
    "pending",
    "qualified",
    "nurture",
    "unqualified",
]


# =====================================================
# 1. LEAD PROFILE
# =====================================================

class LeadBase(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None

    organization_name: str | None = None
    job_title: str | None = None
    industry: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip().lower()

        if not value:
            return None

        # Basic validation without requiring
        # an additional email-validator package.
        if (
            "@" not in value
            or value.startswith("@")
            or value.endswith("@")
        ):
            raise ValueError("Invalid email address")

        return value


class LeadCreate(LeadBase):
    """POST /api/v1/leads"""
    pass


class LeadUpdate(BaseModel):
    """PATCH /api/v1/leads/{lead_id}"""

    full_name: str | None = None
    email: str | None = None
    phone: str | None = None

    organization_name: str | None = None
    job_title: str | None = None
    industry: str | None = None

    lead_status: LeadStatus | None = None


class LeadResponse(ORMResponse):
    lead_id: UUID
    company_id: UUID

    full_name: str | None = None
    email: str | None = None
    phone: str | None = None

    organization_name: str | None = None
    job_title: str | None = None
    industry: str | None = None

    lead_status: LeadStatus
    created_at: datetime
    updated_at: datetime | None = None


class LeadListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[LeadResponse]


# =====================================================
# 2. LEAD SOURCE
# =====================================================

class LeadSourceBase(BaseModel):
    source_name: str = Field(min_length=1)
    source_type: str = Field(min_length=1)
    source_reference: str | None = None

    @field_validator(
        "source_name",
        "source_type",
    )
    @classmethod
    def validate_required_text(
        cls,
        value: str,
    ) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Value cannot be blank")

        return value


class LeadSourceCreate(LeadSourceBase):
    pass


class LeadSourceUpdate(BaseModel):
    source_name: str | None = Field(
        default=None,
        min_length=1,
    )
    source_type: str | None = Field(
        default=None,
        min_length=1,
    )
    source_reference: str | None = None


class LeadSourceResponse(ORMResponse):
    source_id: UUID
    company_id: UUID

    source_name: str
    source_type: str
    source_reference: str | None = None


class LeadSourceListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[LeadSourceResponse]


# =====================================================
# 3. LEAD QUALIFICATION
# =====================================================

class LeadQualificationBase(BaseModel):
    source_id: UUID | None = None

    lead_score: int | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    confidence_score: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )

    intent_level: IntentLevel = "unknown"

    qualification_status: QualificationStatus = (
        "pending"
    )

    qualification_reason: str | None = None
    recommended_action: str | None = None
    scoring_version: str | None = None


class LeadQualificationCreate(
    LeadQualificationBase
):
    """
    Create a new lead qualification evaluation.

    lead_id comes from the route.
    company_id comes from authorization context.

    date_id references the existing dim_date.
    """

    date_id: int = Field(gt=0)


class LeadQualificationUpdate(BaseModel):
    """
    Update an existing evaluation.

    Use model_dump(exclude_unset=True) when
    passing fields into CRUD.
    """

    lead_score: int | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    confidence_score: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )

    intent_level: IntentLevel | None = None
    qualification_status: QualificationStatus | None = None

    qualification_reason: str | None = None
    recommended_action: str | None = None
    scoring_version: str | None = None


class LeadQualificationResponse(ORMResponse):
    qualification_id: UUID

    company_id: UUID
    lead_id: UUID
    source_id: UUID | None = None

    date_id: int

    lead_score: int | None = None
    confidence_score: float | None = None

    intent_level: IntentLevel
    qualification_status: QualificationStatus

    qualification_reason: str | None = None
    recommended_action: str | None = None
    scoring_version: str | None = None

    evaluated_at: datetime


# =====================================================
# 4. QUALIFICATION HISTORY
# =====================================================

class LeadQualificationHistoryResponse(BaseModel):
    lead_id: UUID
    total: int = Field(ge=0)
    items: list[LeadQualificationResponse]


# =====================================================
# 5. LEAD DETAILS WITH LATEST EVALUATION
# =====================================================

class LeadDetailResponse(BaseModel):
    lead: LeadResponse
    latest_qualification: (
        LeadQualificationResponse | None
    ) = None
