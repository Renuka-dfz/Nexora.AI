from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)


CompanyName = Annotated[
    str,
    StringConstraints(min_length=1, max_length=200, strip_whitespace=True),
]
KnowledgeTitle = Annotated[
    str,
    StringConstraints(min_length=1, max_length=255, strip_whitespace=True),
]
VerificationStatus = Literal["pending", "verified", "rejected", "conflicting"]


class CompanyCreate(BaseModel):
    company_name: CompanyName
    website_url: AnyHttpUrl | None = None
    company_overview: str | None = None
    industry: str | None = Field(default=None, max_length=150)
    headquarters: str | None = Field(default=None, max_length=200)


class CompanyUpdate(BaseModel):
    company_name: CompanyName | None = None
    website_url: AnyHttpUrl | None = None
    company_overview: str | None = None
    industry: str | None = Field(default=None, max_length=150)
    headquarters: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "company_name" in self.model_fields_set and self.company_name is None:
            raise ValueError("company_name cannot be null")
        return self


class CompanyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_id: UUID
    company_name: str
    website_url: str | None
    company_overview: str | None
    industry: str | None
    headquarters: str | None
    created_at: datetime


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    category_name: str


class KnowledgeCreate(BaseModel):
    category_id: int = Field(gt=0)
    source_id: UUID
    title: KnowledgeTitle
    description: str | None = None


class KnowledgeUpdate(BaseModel):
    title: KnowledgeTitle | None = None
    description: str | None = None

    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("title cannot be null")
        return self


class KnowledgeVerificationUpdate(BaseModel):
    verification_status: Literal["verified", "rejected"]


class SourceCreate(BaseModel):
    source_url: AnyHttpUrl
    source_type: str = Field(default="website", min_length=1, max_length=30)
    page_title: str | None = Field(default=None, max_length=255)


class SourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source_id: UUID
    company_id: UUID
    source_url: str
    source_type: str
    page_title: str | None
    last_crawled_at: datetime | None


class KnowledgeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fact_id: UUID
    company_id: UUID
    category_id: int
    source_id: UUID
    title: str
    description: str | None
    verification_status: VerificationStatus
    extracted_at: datetime


class KnowledgeListResponse(BaseModel):
    company_id: UUID
    total: int = Field(ge=0)
    items: list[KnowledgeRead]


class CategoryListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[CategoryRead]


class SourceListResponse(BaseModel):
    company_id: UUID
    total: int = Field(ge=0)
    items: list[SourceRead]
