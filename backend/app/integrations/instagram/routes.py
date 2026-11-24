"""
Nexora.AI - Instagram Integration API Endpoints.
Provides status verification and authorized direct publishing for approved Instagram assets.
"""

from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
from app.modules.identity.models import User
from app.modules.marketing.models import DimContent
from app.integrations.instagram.client import InstagramAPIClient
from app.integrations.instagram.publishing import (
    execute_full_instagram_publish,
)
from app.integrations.instagram.schemas import InstagramPublishRequest
from app.integrations.instagram.caption import clean_instagram_caption

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations/instagram",
    tags=["Instagram Integration"],
)


class InstagramStatusResponse(BaseModel):
    connected: bool
    user_id: Optional[str] = None
    has_token: bool
    account_username: Optional[str] = None
    account_name: Optional[str] = None
    message: str


class InstagramPublishPayload(BaseModel):
    image_url: Optional[str] = Field(
        default=None,
        description="Optional compatibility field; if supplied, it must match the approved image URL.",
    )
    image_b64: Optional[str] = Field(
        default=None,
        description="Image uploads are not accepted during publishing; approve the saved image first.",
    )
    caption: Optional[str] = Field(
        default=None,
        description="Optional compatibility field; if supplied, it must match the approved caption.",
    )


class InstagramPublishResult(BaseModel):
    success: bool
    media_id: str
    message: str


@router.get(
    "/status",
    response_model=InstagramStatusResponse,
)
async def get_instagram_status(
    user: User = Depends(get_current_user),
):
    """
    Check configured Meta Instagram Graph API credentials and return account connection state.
    """
    token = (settings.IG_ACCESS_TOKEN or "").strip()
    user_id = (settings.IG_USER_ID or "").strip()

    if not token or not user_id:
        return InstagramStatusResponse(
            connected=False,
            user_id=user_id or None,
            has_token=bool(token),
            message="Instagram credentials missing. Set IG_ACCESS_TOKEN and IG_USER_ID in .env",
        )

    client = InstagramAPIClient(access_token=token, timeout=5.0)
    username = None
    name = None
    try:
        accounts = await client.get_instagram_business_accounts()
        for acc in accounts:
            if acc.id == user_id:
                username = acc.username
                name = acc.name
                break
        if not username and accounts:
            username = accounts[0].username
            name = accounts[0].name
    except Exception as exc:
        logger.debug("Remote account discovery check: %s", exc)

    return InstagramStatusResponse(
        connected=True,
        user_id=user_id,
        has_token=True,
        account_username=username or f"ig_account_{user_id[-4:]}",
        account_name=name or "Instagram Business Account",
        message="Instagram Graph API connected and authorized for publishing.",
    )


@router.post(
    "/publish/{content_id}",
    response_model=InstagramPublishResult,
)
async def publish_content_to_instagram(
    content_id: UUID,
    payload: Optional[InstagramPublishPayload] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Publish an approved marketing asset to the connected Instagram Business account.
    Enforces mandatory human review sign-off and role permissions.
    """
    token = (settings.IG_ACCESS_TOKEN or "").strip()
    user_id = (settings.IG_USER_ID or "").strip()

    if not token or not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instagram credentials not configured. Please ensure IG_ACCESS_TOKEN and IG_USER_ID are set in .env",
        )

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

    if content.platform_target != "instagram":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only approved Instagram content can be published to Instagram.",
        )

    image_url = (content.image_url or "").strip()
    parsed_image_url = urlparse(image_url)
    if parsed_image_url.scheme != "https" or not parsed_image_url.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The approved image must have a public HTTPS URL before publishing.",
        )

    caption = (content.caption or clean_instagram_caption(content.content_text)).strip()
    if not caption or len(caption) > 2200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The approved caption must contain 1 to 2,200 characters before publishing.",
        )

    if payload:
        if payload.image_b64:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The publish request cannot replace the approved image. Update and reapprove the content first.",
            )
        if payload.image_url and payload.image_url.strip() != image_url:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The publish request image does not match the approved image.",
            )
        if payload.caption and payload.caption.strip() != caption:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The publish request caption does not match the approved caption.",
            )

    client = InstagramAPIClient(access_token=token)
    api_host = urlparse(client.base_url).hostname or client.base_url
    req = InstagramPublishRequest(
        instagram_user_id=user_id,
        caption=caption,
        image_url=image_url,
    )

    try:
        publish_res = await execute_full_instagram_publish(client, req)
        return InstagramPublishResult(
            success=True,
            media_id=publish_res.media_id,
            message=f"Post published successfully to Instagram! Media ID: {publish_res.media_id}",
        )
    except httpx.ConnectError as exc:
        logger.exception("Instagram Graph API connection to %s failed", api_host)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"The backend connection to {api_host} was reset before Meta returned a response. "
                "Allow outbound HTTPS to this host in your firewall or proxy. "
                "If this host is graph.facebook.com, an Instagram User access token from Business Login for Instagram uses graph.instagram.com instead; "
                "the access token and Instagram account ID must both come from that same login flow."
            ),
        )
    except Exception as exc:
        logger.exception("Failed to publish to Instagram: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Instagram publication failed: {str(exc)}",
        )
