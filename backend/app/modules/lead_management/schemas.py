from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)


LeadStatus = Literal["active", "inactive", "converted"]
IntentLevel = Literal["unknown", "low", "medium", "high"]
QualificationStatus = Literal["pending", "qualified", "nurture", "unqualified"]


class LeadCreate(BaseModel):
    company_id: UUID
    full_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    organization_name: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=150)
    industry: str | None = Field(default=None, max_length=150)

    @field_validator(
        "full_name", "phone", "organization_name", "job_title", "industry"
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class LeadUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    organization_name: str | None = Field(default=None, max_length=200)
    job_title: str | None = Field(default=None, max_length=150)
    industry: str | None = Field(default=None, max_length=150)
    lead_status: LeadStatus | None = None

    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "lead_status" in self.model_fields_set and self.lead_status is None:
            raise ValueError("lead_status cannot be null")
        return self


class LeadRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lead_id: UUID
    company_id: UUID
    full_name: str | None
    email: str | None
    phone: str | None
    organization_name: str | None
    job_title: str | None
    industry: str | None
    lead_status: LeadStatus
    created_at: datetime
    updated_at: datetime


class LeadListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[LeadRead]


class LeadSourceCreate(BaseModel):
    company_id: UUID
    source_name: str = Field(min_length=1, max_length=150)
    source_type: str = Field(min_length=1, max_length=50)
    source_reference: str | None = None

    @field_validator("source_name", "source_type")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class LeadSourceUpdate(BaseModel):
    source_name: str | None = Field(default=None, min_length=1, max_length=150)
    source_type: str | None = Field(default=None, min_length=1, max_length=50)
    source_reference: str | None = None

    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        for field in ("source_name", "source_type"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class LeadSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: UUID
    company_id: UUID
    source_name: str
    source_type: str
    source_reference: str | None
    created_at: datetime


class LeadSourceListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[LeadSourceRead]


class QualificationCreate(BaseModel):
    source_id: UUID | None = None
    lead_score: int | None = Field(default=None, ge=0, le=100)
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    intent_level: IntentLevel = "unknown"
    qualification_status: QualificationStatus = "pending"
    qualification_reason: str | None = None
    recommended_action: str | None = None
    scoring_version: str | None = Field(default=None, max_length=50)


class QualificationUpdate(BaseModel):
    lead_score: int | None = Field(default=None, ge=0, le=100)
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    intent_level: IntentLevel | None = None
    qualification_status: QualificationStatus | None = None
    qualification_reason: str | None = None
    recommended_action: str | None = None
    scoring_version: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        for field in ("intent_level", "qualification_status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class QualificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    qualification_id: UUID
    company_id: UUID
    lead_id: UUID
    source_id: UUID | None
    date_id: int
    lead_score: int | None
    confidence_score: float | None
    intent_level: IntentLevel
    qualification_status: QualificationStatus
    qualification_reason: str | None
    recommended_action: str | None
    scoring_version: str | None
    evaluated_at: datetime
    created_at: datetime


class QualificationHistoryResponse(BaseModel):
    lead_id: UUID
    total: int = Field(ge=0)
    items: list[QualificationRead]


class LeadDetailResponse(BaseModel):
    lead: LeadRead
    latest_qualification: QualificationRead | None = None
