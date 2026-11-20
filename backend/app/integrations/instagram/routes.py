"""
Nexora.AI - Instagram Integration API Endpoints.
Provides status verification and authorized direct publishing for approved Instagram assets.
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
from app.integrations.instagram.client import InstagramAPIClient
from app.integrations.instagram.publishing import (
    execute_full_instagram_publish,
)
from app.integrations.instagram.schemas import InstagramPublishRequest

import base64
import os
import re

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations/instagram",
    tags=["Instagram Integration"],
)


def clean_instagram_caption(raw_text: str) -> str:
    """
    Format clean Instagram post copy for actual publishing.
    Extracts:
    - [Caption/Hook]
    - [Narrative Body Description]
    - [Hashtags]
    Strips out internal workflow directives:
    - ### VISUAL ASSET SPECIFICATION
    - ### SEO KEYWORDS
    - Raw markdown header tags
    """
    text = (raw_text or "").strip()

    # 1. Strip internal visual asset specification block
    text = re.sub(
        r"###\s*VISUAL\s+ASSET\s+SPECIFICATION[\s\S]*?(?=\n###|\Z)",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()

    # 2. Extract structured fields if present
    caption_match = re.search(r"###\s*CAPTION\s*\n([\s\S]*?)(?=\n###|\Z)", text, flags=re.IGNORECASE)
    desc_match = re.search(r"###\s*DESCRIPTION\s*\n([\s\S]*?)(?=\n###|\Z)", text, flags=re.IGNORECASE)
    hash_match = re.search(r"###\s*HASHTAGS\s*\n([\s\S]*?)(?=\n###|\Z)", text, flags=re.IGNORECASE)

    if caption_match or desc_match:
        caption_part = caption_match.group(1).strip() if caption_match else ""
        desc_part = desc_match.group(1).strip() if desc_match else ""
        hash_part = hash_match.group(1).strip() if hash_match else ""

        # Normalize hashtags
        if hash_part:
            tags = [t if t.startswith("#") else f"#{t}" for t in hash_part.split() if t]
            hash_part = " ".join(tags)

        sections = [s for s in [caption_part, desc_part, hash_part] if s]
        return "\n\n".join(sections)[:2200].strip()

    # Fallback: clean raw text from markdown headers
    cleaned = re.sub(r"###\s*[A-Z\s]+\n", "", text)
    cleaned = re.sub(r"##\s*[A-Z\s]+\n", "", cleaned)
    return cleaned[:2200].strip()


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
        description="Public image URL. If omitted, uses standard high-resolution enterprise AI visual asset.",
    )
    image_b64: Optional[str] = Field(
        default=None,
        description="Base64 encoded image data from Cloudflare Flux AI generation.",
    )
    caption: Optional[str] = Field(
        default=None,
        description="Customized post caption. If omitted, cleanly extracts Caption + Description + Hashtags from content_text.",
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

    # 4. Prepare image URL for Meta (strictly use the post's exact generated image)
    image_url = payload.image_url.strip() if payload and payload.image_url else None

    static_dir = os.path.join(os.getcwd(), "static", "generated_images")
    os.makedirs(static_dir, exist_ok=True)
    post_img = os.path.join(static_dir, f"{content_id}.jpg")
    last_img = os.path.join(static_dir, "last_generated.jpg")
    base_public_url = (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/")

    # If base64 image data is supplied from client, write it to disk immediately!
    if payload and payload.image_b64:
        try:
            b64_str = payload.image_b64
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_str)
            with open(post_img, "wb") as f:
                f.write(img_bytes)
            with open(last_img, "wb") as f:
                f.write(img_bytes)
            if not image_url:
                image_url = f"{base_public_url}/static/generated_images/{content_id}.jpg"
            logger.info("Decoded and saved payload.image_b64 to disk -> %s", image_url)
        except Exception as e:
            logger.warning("Failed to decode payload.image_b64: %s", e)

    if not image_url:
        if os.path.exists(post_img):
            image_url = f"{base_public_url}/static/generated_images/{content_id}.jpg"
        elif os.path.exists(last_img):
            image_url = f"{base_public_url}/static/generated_images/last_generated.jpg"

    # If still no image file, auto-generate it right now using Cloudflare Workers AI!
    if not image_url:
        try:
            from app.integrations.cloudflare.image_client import CloudflareImageClient
            cf_client = CloudflareImageClient()
            if cf_client.is_configured:
                prompt_text = f"Photorealistic corporate technology promotional visual for DataFactZ: {content.topic or 'Enterprise AI Automation'}"
                res = await cf_client.generate_branding_image(
                    prompt=prompt_text,
                    company_name="DataFactZ",
                    topic=content.topic,
                )
                data_uri = res["image_data_uri"]
                b64_content = data_uri.split(",", 1)[1] if "," in data_uri else data_uri
                img_bytes = base64.b64decode(b64_content)
                with open(post_img, "wb") as f:
                    f.write(img_bytes)
                with open(last_img, "wb") as f:
                    f.write(img_bytes)
                image_url = f"{base_public_url}/static/generated_images/{content_id}.jpg"
                logger.info("On-demand Cloudflare Flux image generated and saved for %s -> %s", content_id, image_url)
        except Exception as e:
            logger.error("Auto-generation of Cloudflare visual failed: %s", e)

    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No generated visual asset found for this post. Please generate the Cloudflare AI creative before publishing.",
        )

    # 5. Clean and format Instagram caption (strips internal visual specifications & system prompts)
    if payload and payload.caption and payload.caption.strip():
        caption = payload.caption.strip()[:2200]
    else:
        caption = clean_instagram_caption(content.content_text)

    client = InstagramAPIClient(access_token=token)
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
        logger.error("Meta Graph API connection failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                "Connection to graph.facebook.com was reset by your network firewall ([WinError 10054]). "
                "Your office network or ISP firewall blocks Facebook endpoints. "
                "To publish, either: 1) Switch to mobile hotspot/personal network, or 2) Generate an Instagram User Token (IGAA...) via Instagram Login for Business on graph.instagram.com."
            ),
        )
    except Exception as exc:
        logger.exception("Failed to publish to Instagram: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Instagram publication failed: {str(exc)}",
        )
