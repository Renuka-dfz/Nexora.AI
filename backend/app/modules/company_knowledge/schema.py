
"""
Nexora.AI - Company Knowledge API Schemas

Pydantic v2 schemas for:
1. Company profiles
2. Company intelligence categories
3. Website / information sources
4. Extracted company intelligence

These schemas validate API requests and serialize
SQLAlchemy ORM objects into API responses.

No database operations are performed here.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
)


# =====================================================
# SHARED CONFIGURATION
# =====================================================

class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


VerificationStatus = Literal[
    "pending",
    "verified",
    "rejected",
    "conflicting",
]


# =====================================================
# 1. COMPANY SCHEMAS
# =====================================================

class CompanyBase(BaseModel):
    company_name: str = Field(
        min_length=1,
        max_length=200,
    )
    website_url: str | None = None
    company_overview: str | None = None
    industry: str | None = Field(
        default=None,
        max_length=150,
    )
    headquarters: str | None = Field(
        default=None,
        max_length=200,
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Company name cannot be blank")
        return value


class CompanyCreate(CompanyBase):
    """Request body for creating a company."""
    pass


class CompanyUpdate(BaseModel):
    """All fields optional for partial updates."""

    company_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
    )
    website_url: str | None = None
    company_overview: str | None = None
    industry: str | None = Field(
        default=None,
        max_length=150,
    )
    headquarters: str | None = Field(
        default=None,
        max_length=200,
    )

    @field_validator("company_name")
    @classmethod
    def validate_company_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return value

        value = value.strip()
        if not value:
            raise ValueError("Company name cannot be blank")
        return value


class CompanyResponse(ORMResponse):
    company_id: UUID
    company_name: str
    website_url: str | None
    company_overview: str | None
    industry: str | None
    headquarters: str | None
    created_at: datetime


# =====================================================
# 2. CATEGORY SCHEMAS
# =====================================================

CompanyCategoryName = Literal[
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Projects",
    "Innovations and Research",
    "Brand Identities",
    "Knowledge Resources",
    "Case Studies",
    "Achievements",
    "Industry Expertise",
    "Customers",
]


class CategoryResponse(ORMResponse):
    category_id: int
    category_name: str


# =====================================================
# 3. SOURCE SCHEMAS
# =====================================================

class SourceCreate(BaseModel):
    source_url: HttpUrl
    source_type: str = Field(
        default="website",
        min_length=1,
        max_length=30,
    )
    page_title: str | None = Field(
        default=None,
        max_length=255,
    )


class SourceResponse(ORMResponse):
    source_id: UUID
    company_id: UUID
    source_url: str
    source_type: str
    page_title: str | None
    last_crawled_at: datetime | None


# =====================================================
# 4. COMPANY INTELLIGENCE SCHEMAS
# =====================================================

class CompanyKnowledgeCreate(BaseModel):
    category_id: int = Field(gt=0)
    source_id: UUID
    title: str = Field(
        min_length=1,
        max_length=255,
    )
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value


class CompanyKnowledgeUpdate(BaseModel):
    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    description: str | None = None

    @field_validator("title")
    @classmethod
    def validate_title(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return value

        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value


class CompanyKnowledgeResponse(ORMResponse):
    fact_id: UUID
    company_id: UUID
    category_id: int
    source_id: UUID
    title: str
    description: str | None
    verification_status: VerificationStatus
    extracted_at: datetime


# =====================================================
# 5. LIST RESPONSE SCHEMAS
# =====================================================

class CompanyKnowledgeListResponse(BaseModel):
    company_id: UUID
    total: int = Field(ge=0)
    items: list[CompanyKnowledgeResponse]


class CompanyListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[CompanyResponse]


class CategoryListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[CategoryResponse]


class SourceListResponse(BaseModel):
    company_id: UUID
    total: int = Field(ge=0)
    items: list[SourceResponse]


# =====================================================
# 6. VERIFICATION SCHEMA
# =====================================================

class CompanyKnowledgeVerificationUpdate(BaseModel):
    verification_status: VerificationStatus
