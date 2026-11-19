"""
Nexora.AI - LinkedIn API Pydantic Schemas.
"""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class LinkedInOAuthToken(BaseModel):
    """OAuth 2.0 access token response from LinkedIn."""
    access_token: str
    expires_in: int
    refresh_token: str | None = None
    refresh_token_expires_in: int | None = None
    scope: str = ""
    token_type: str = "Bearer"


class LinkedInProfile(BaseModel):
    """User profile retrieved from LinkedIn OIDC userinfo endpoint."""
    sub: str  # Member URN identifier
    name: str
    given_name: str | None = None
    family_name: str | None = None
    picture: str | None = None
    email: str | None = None


class LinkedInOrganization(BaseModel):
    """Administered company organization page."""
    id: str
    localized_name: str
    vanity_name: str | None = None
    urn: str


class LinkedInPostRequest(BaseModel):
    """Payload to create a post via LinkedIn Posts REST API."""
    author_urn: str = Field(description="URN of author, e.g. urn:li:person:... or urn:li:organization:...")
    commentary: str = Field(min_length=1, max_length=3000)
    visibility: Literal["PUBLIC", "CONNECTIONS"] = "PUBLIC"
    title: str | None = None
    article_url: str | None = None
    media_urn: str | None = None


class LinkedInPostResponse(BaseModel):
    """Response returned upon successful creation of a LinkedIn post."""
    post_urn: str
    status: Literal["created", "failed"] = "created"
    response_headers: dict[str, str] = Field(default_factory=dict)


class LinkedInAnalyticsResponse(BaseModel):
    """Post engagement and impression analytics."""
    post_urn: str
    impressions: int = 0
    unique_impressions: int = 0
    clicks: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    engagement_rate: float = 0.0
