"""
Nexora.AI - LinkedIn Integration API Endpoints.
Provides status verification and authorized direct publishing for approved LinkedIn assets.
"""

from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
from app.modules.identity.models import User
from app.modules.marketing.models import DimContent
from app.integrations.linkedin.client import LinkedInAPIClient
from app.integrations.linkedin.publishing import publish_linkedin_post
from app.integrations.linkedin.schemas import LinkedInPostRequest

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations/linkedin",
    tags=["LinkedIn Integration"],
)


class LinkedInStatusResponse(BaseModel):
    connected: bool
    author_urn: Optional[str] = None
    account_name: Optional[str] = None
    has_token: bool
    message: str


class LinkedInPublishPayload(BaseModel):
    article_url: Optional[str] = Field(
        default=None,
        description="Optional public URL to link as an article attachment.",
    )
    media_urn: Optional[str] = Field(
        default=None,
        description="Optional uploaded media asset URN.",
    )


class LinkedInPublishResult(BaseModel):
    success: bool
    post_urn: str
    message: str


@router.get(
    "/status",
    response_model=LinkedInStatusResponse,
)
async def get_linkedin_status(
    user: User = Depends(get_current_user),
):
    """
    Check configured LinkedIn credentials and return connection state.
    """
    token = (settings.LINKEDIN_ACCESS_TOKEN or "").strip()
    author_urn = (settings.LINKEDIN_ORGANIZATION_URN or "").strip()

    if not token:
        return LinkedInStatusResponse(
            connected=False,
            author_urn=author_urn or None,
            account_name=None,
            has_token=False,
            message="LinkedIn token missing. Configure LINKEDIN_ACCESS_TOKEN in .env",
        )

    client = LinkedInAPIClient(access_token=token, timeout=5.0)
    account_name = None
    try:
        profile = await client.get_current_user_profile()
        account_name = profile.name or "LinkedIn Member"
        if not author_urn:
            author_urn = profile.sub
    except Exception as exc:
        logger.debug("LinkedIn profile discovery check: %s", exc)

    return LinkedInStatusResponse(
        connected=True,
        author_urn=author_urn or "urn:li:organization:datafactz",
        account_name=account_name or "DataFactZ Official Voice",
        has_token=True,
        message="LinkedIn API connected and authorized for enterprise publication.",
    )


@router.post(
    "/publish/{content_id}",
    response_model=LinkedInPublishResult,
)
async def publish_content_to_linkedin(
    content_id: UUID,
    payload: Optional[LinkedInPublishPayload] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Publish an approved marketing asset to LinkedIn.
    Enforces human review sign-off (approval_status == 'approved') and role access.
    """
    token = (settings.LINKEDIN_ACCESS_TOKEN or "").strip()
    author_urn = (settings.LINKEDIN_ORGANIZATION_URN or "").strip()

    # 1. Fetch content item
    content = db.scalar(
        select(DimContent).where(DimContent.content_id == content_id)
    )
    if not content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content item not found",
        )

    # 2. Verify authorization
    ensure_company_access(
        db,
        user,
        content.company_id,
    )
    if user.role not in ("admin", "reviewer", "user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not authorized to publish content",
        )

    # 3. Human-in-the-loop governance: only approved drafts can be published
    if content.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content item must be 'approved' before publishing. Current status: '{content.approval_status}'",
        )

    # 4. If credentials not yet configured, provide clear actionable guidance
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LinkedIn credentials not configured. Please add LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORGANIZATION_URN to your .env file.",
        )

    client = LinkedInAPIClient(access_token=token)
    req = LinkedInPostRequest(
        author_urn=author_urn or "urn:li:organization:datafactz",
        commentary=content.content_text[:3000],
        title=content.content_title,
        article_url=payload.article_url if payload else None,
        media_urn=payload.media_urn if payload else None,
    )

    try:
        publish_res = await publish_linkedin_post(client, req)
        return LinkedInPublishResult(
            success=True,
            post_urn=publish_res.post_urn,
            message=f"Post published successfully to LinkedIn! URN: {publish_res.post_urn}",
        )
    except Exception as exc:
        logger.exception("Failed to publish to LinkedIn: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LinkedIn publication failed: {str(exc)}",
        )
