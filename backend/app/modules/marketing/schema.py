
"""
Nexora.AI - Marketing API Schemas

Pydantic v2 request and response schemas for:
- Marketing Content
- Content Approval
- Social Accounts
- Marketing Performance
- Date Dimension

No database operations or social API integrations.
"""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


# =====================================================
# SHARED CONFIGURATION
# =====================================================

class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


Platform = Literal["linkedin", "instagram"]

GenerationType = Literal["ai", "manual"]

ApprovalStatus = Literal[
    "draft",
    "pending",
    "approved",
    "rejected",
]

ConnectionStatus = Literal[
    "connected",
    "disconnected",
    "expired",
]

MetricPeriod = Literal["daily", "lifetime"]


# =====================================================
# 1. MARKETING CONTENT
# =====================================================

class ContentBase(BaseModel):
    content_title: str = Field(
        min_length=1,
        max_length=255,
    )
    content_type: str = Field(min_length=1)
    platform_target: Platform
    content_text: str = Field(min_length=1)

    topic: str | None = None
    tone: str | None = None

    @field_validator(
        "content_title",
        "content_type",
        "content_text",
    )
    @classmethod
    def validate_required_text(
        cls,
        value: str,
    ) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Text cannot be blank")
        return value


class ContentCreate(ContentBase):
    """POST /marketing/content"""

    generation_type: GenerationType = "manual"


class ContentUpdate(BaseModel):
    """PATCH /marketing/content/{content_id}"""

    content_title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )
    content_type: str | None = Field(
        default=None,
        min_length=1,
    )
    platform_target: Platform | None = None
    content_text: str | None = Field(
        default=None,
        min_length=1,
    )
    topic: str | None = None
    tone: str | None = None

    @field_validator(
        "content_title",
        "content_type",
        "content_text",
    )
    @classmethod
    def validate_required_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        value = value.strip()
        if not value:
            raise ValueError("Text cannot be blank")
        return value


class ContentResponse(ORMResponse):
    content_id: UUID
    company_id: UUID

    content_title: str
    content_type: str
    platform_target: str
    content_text: str

    topic: str | None = None
    tone: str | None = None

    generation_type: str
    approval_status: ApprovalStatus
    created_at: datetime


class ContentListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[ContentResponse]


# =====================================================
# 2. CONTENT APPROVAL
# =====================================================

class ContentApprovalUpdate(BaseModel):
    """Used by an authorized approval workflow."""

    approval_status: ApprovalStatus


# =====================================================
# 3. SOCIAL ACCOUNT
# =====================================================

class SocialAccountBase(BaseModel):
    platform: Platform

    external_account_id: str = Field(min_length=1)
    account_name: str | None = None
    account_handle: str | None = None
    account_type: str | None = None

    @field_validator("external_account_id")
    @classmethod
    def validate_account_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError(
                "External account ID cannot be blank"
            )
        return value


class SocialAccountCreate(SocialAccountBase):
    pass


class SocialAccountUpdate(BaseModel):
    account_name: str | None = None
    account_handle: str | None = None
    account_type: str | None = None


class SocialConnectionStatusUpdate(BaseModel):
    """For trusted OAuth integration services only."""

    connection_status: ConnectionStatus


class SocialAccountResponse(ORMResponse):
    social_account_id: UUID
    company_id: UUID

    platform: str
    external_account_id: str
    account_name: str | None = None
    account_handle: str | None = None
    account_type: str | None = None

    connection_status: ConnectionStatus
    connected_at: datetime | None = None


class SocialAccountListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[SocialAccountResponse]


# =====================================================
# 4. DATE DIMENSION
# =====================================================

class DateResponse(ORMResponse):
    date_id: int
    full_date: date

    day_of_week: str
    day_of_month: int
    month_number: int
    month_name: str

    quarter: int
    year: int
    is_weekend: bool


# =====================================================
# 5. MARKETING PERFORMANCE
# =====================================================

class PerformanceMetrics(BaseModel):
    impressions: int | None = Field(
        default=None, ge=0
    )
    reach: int | None = Field(
        default=None, ge=0
    )
    likes: int | None = Field(
        default=None, ge=0
    )
    comments: int | None = Field(
        default=None, ge=0
    )
    shares: int | None = Field(
        default=None, ge=0
    )
    saves: int | None = Field(
        default=None, ge=0
    )
    clicks: int | None = Field(
        default=None, ge=0
    )
    video_views: int | None = Field(
        default=None, ge=0
    )


class MarketingPerformanceCreate(PerformanceMetrics):
    """
    Store a new performance snapshot.

    This request should come from a trusted
    integration service, not an ordinary user.
    """

    content_id: UUID
    social_account_id: UUID
    published_post_id: UUID

    collected_at: datetime
    metric_period: MetricPeriod = "lifetime"
    metric_source: str | None = None

    @field_validator("collected_at")
    @classmethod
    def validate_collected_at(
        cls,
        value: datetime,
    ) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(
                "collected_at must include a timezone"
            )
        return value


class MarketingPerformanceUpdate(PerformanceMetrics):
    """
    Correct metric values in an existing snapshot.

    Routes should pass only explicitly supplied
    fields using model_dump(exclude_unset=True).
    """
    pass


class MarketingPerformanceResponse(
    PerformanceMetrics,
    ORMResponse,
):
    performance_id: UUID
    company_id: UUID

    content_id: UUID
    social_account_id: UUID
    published_post_id: UUID

    date_id: int
    collected_at: datetime

    metric_period: str
    metric_source: str | None = None
    retrieval_status: str


class MarketingPerformanceListResponse(BaseModel):
    total: int = Field(ge=0)
    items: list[MarketingPerformanceResponse]
