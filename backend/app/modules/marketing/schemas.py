from datetime import datetime
from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


Platform = Literal["linkedin", "instagram"]
GenerationType = Literal["ai", "manual"]
ApprovalStatus = Literal["draft", "pending", "approved", "rejected"]
ConnectionStatus = Literal["connected", "disconnected", "expired"]
MetricPeriod = Literal["daily", "lifetime"]


class ContentCreate(BaseModel):
    company_id: UUID
    content_title: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=50)
    platform_target: Platform
    content_text: str = Field(min_length=1)
    topic: str | None = Field(default=None, max_length=255)
    tone: str | None = Field(default=None, max_length=50)
    generation_type: GenerationType

    @field_validator("content_title", "content_type", "content_text")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Text cannot be blank")
        return value


class ContentUpdate(BaseModel):
    content_title: str | None = Field(default=None, min_length=1, max_length=255)
    content_type: str | None = Field(default=None, min_length=1, max_length=50)
    platform_target: Platform | None = None
    content_text: str | None = Field(default=None, min_length=1)
    topic: str | None = Field(default=None, max_length=255)
    tone: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        required_fields = {
            "content_title",
            "content_type",
            "platform_target",
            "content_text",
        }
        if any(
            name in required_fields and getattr(self, name) is None
            for name in self.model_fields_set
        ):
            raise ValueError("Content fields cannot be null")
        return self

    @field_validator("content_title", "content_type", "content_text")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Text cannot be blank")
        return value


class ContentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    content_id: UUID
    company_id: UUID
    content_title: str
    content_type: str
    platform_target: str
    topic: str | None
    content_text: str
    tone: str | None
    generation_type: GenerationType
    approval_status: ApprovalStatus
    created_at: datetime


class ContentListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[ContentRead]


class SocialAccountCreate(BaseModel):
    company_id: UUID
    platform: Platform
    external_account_id: str = Field(min_length=1, max_length=255)
    account_name: str | None = Field(default=None, max_length=200)
    account_handle: str | None = Field(default=None, max_length=200)
    account_type: str | None = Field(default=None, max_length=50)

    @field_validator("external_account_id")
    @classmethod
    def strip_account_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("External account ID cannot be blank")
        return value


class SocialAccountUpdate(BaseModel):
    account_name: str | None = Field(default=None, max_length=200)
    account_handle: str | None = Field(default=None, max_length=200)
    account_type: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def require_changes(self):
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class SocialAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    social_account_id: UUID
    company_id: UUID
    platform: str
    external_account_id: str
    account_name: str | None
    account_handle: str | None
    account_type: str | None
    connection_status: ConnectionStatus
    connected_at: datetime | None


class SocialAccountListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[SocialAccountRead]


class DateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date_id: int
    full_date: date
    day_of_week: str
    day_of_month: int
    month_number: int
    month_name: str
    quarter: int
    year: int
    is_weekend: bool


class PerformanceCreate(BaseModel):
    company_id: UUID
    content_id: UUID
    social_account_id: UUID
    published_post_id: UUID
    collected_at: datetime
    metric_period: MetricPeriod = "lifetime"
    metric_source: str | None = Field(default=None, max_length=30)
    impressions: int | None = Field(default=None, ge=0)
    reach: int | None = Field(default=None, ge=0)
    likes: int | None = Field(default=None, ge=0)
    comments: int | None = Field(default=None, ge=0)
    shares: int | None = Field(default=None, ge=0)
    saves: int | None = Field(default=None, ge=0)
    clicks: int | None = Field(default=None, ge=0)
    video_views: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def require_timezone_and_metrics(self):
        if self.collected_at.tzinfo is None or self.collected_at.utcoffset() is None:
            raise ValueError("collected_at must include a timezone")
        if all(getattr(self, name) is None for name in (
            "impressions", "reach", "likes", "comments", "shares", "saves",
            "clicks", "video_views",
        )):
            raise ValueError("At least one metric must be provided")
        return self

    @field_validator("metric_source")
    @classmethod
    def strip_metric_source(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class PerformanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    performance_id: UUID
    company_id: UUID
    content_id: UUID
    social_account_id: UUID
    date_id: int
    published_post_id: UUID
    collected_at: datetime
    impressions: int | None
    reach: int | None
    likes: int | None
    comments: int | None
    shares: int | None
    saves: int | None
    clicks: int | None
    video_views: int | None
    metric_period: MetricPeriod
    metric_source: str | None
    retrieval_status: str
    created_at: datetime


class PerformanceListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[PerformanceRead]
