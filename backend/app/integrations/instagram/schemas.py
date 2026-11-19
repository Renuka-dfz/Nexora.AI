"""
Nexora.AI - Instagram Graph API Pydantic Schemas.
"""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class InstagramOAuthToken(BaseModel):
    """Access token model returned from Meta OAuth dialog / token exchange."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None


class InstagramAccount(BaseModel):
    """Connected Instagram Professional / Business Account."""
    id: str  # Instagram Business Account ID
    username: str
    name: str | None = None
    profile_picture_url: str | None = None
    followers_count: int | None = None


class InstagramPublishRequest(BaseModel):
    """Payload to initiate a container-based post publish to Instagram."""
    instagram_user_id: str
    caption: str = Field(max_length=2200)
    image_url: str
    media_type: Literal["IMAGE", "VIDEO", "CAROUSEL"] = "IMAGE"


class InstagramContainerResponse(BaseModel):
    """Response returned upon creation of an Instagram media container."""
    container_id: str
    status: Literal["created", "in_progress", "finished", "error"] = "created"


class InstagramPublishResponse(BaseModel):
    """Final response returned after container is published to the feed."""
    media_id: str
    status: Literal["published", "failed"] = "published"


class InstagramInsightsResponse(BaseModel):
    """Media level performance metrics from Instagram Graph API."""
    media_id: str
    impressions: int = 0
    reach: int = 0
    saved: int = 0
    engagement: int = 0
    likes: int = 0
    comments: int = 0
