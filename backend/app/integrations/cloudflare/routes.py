"""
Nexora.AI - Cloudflare Integration API Endpoints.
Endpoints for Cloudflare Workers AI image generation for promoting and branding.
"""

from __future__ import annotations

import base64
import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import get_current_user
from app.modules.identity.models import User
from app.integrations.cloudflare.image_client import CloudflareImageClient

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations/cloudflare",
    tags=["Cloudflare Integration"],
)


class CloudflareStatusResponse(BaseModel):
    configured: bool
    account_id: Optional[str] = None
    model: str
    message: str


class GenerateImageRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1500)
    topic: Optional[str] = None
    company_name: Optional[str] = "DataFactZ"
    custom_style: Optional[str] = None
    content_id: Optional[str] = None


class GenerateImageResponse(BaseModel):
    success: bool
    image_url: str
    public_url: Optional[str] = None
    prompt: str
    model: str
    message: str


@router.get(
    "/status",
    response_model=CloudflareStatusResponse,
)
def get_cloudflare_status(
    user: User = Depends(get_current_user),
):
    """Check Cloudflare Workers AI status and configured model."""
    client = CloudflareImageClient()
    if client.is_configured:
        masked_id = client.account_id[:4] + "..." + client.account_id[-4:] if len(client.account_id) > 8 else "configured"
        return CloudflareStatusResponse(
            configured=True,
            account_id=masked_id,
            model=client.model,
            message="Cloudflare Workers AI (Flux-1-schnell) is ready for image generation.",
        )
    return CloudflareStatusResponse(
        configured=False,
        account_id=None,
        model=client.model,
        message="Cloudflare credentials missing. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env",
    )


@router.post(
    "/generate-image",
    response_model=GenerateImageResponse,
)
async def generate_brand_image(
    request: GenerateImageRequest,
    user: User = Depends(get_current_user),
):
    """Generate high-fidelity promotional branding visuals with Cloudflare Workers AI."""
    client = CloudflareImageClient()
    if not client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cloudflare Workers AI credentials not configured in .env",
        )

    try:
        result = await client.generate_branding_image(
            prompt=request.prompt,
            company_name=request.company_name or "DataFactZ",
            topic=request.topic,
            custom_style=request.custom_style,
        )

        # Automatically persist generated binary JPEG to static folder for Meta Graph API / public CDN access
        data_uri = result["image_data_uri"]
        b64_content = data_uri.split(",", 1)[1] if "," in data_uri else data_uri
        image_bytes = base64.b64decode(b64_content)

        static_dir = os.path.join(os.getcwd(), "static", "generated_images")
        os.makedirs(static_dir, exist_ok=True)

        # Save to last_generated.jpg
        last_gen_path = os.path.join(static_dir, "last_generated.jpg")
        with open(last_gen_path, "wb") as f:
            f.write(image_bytes)

        # If content_id is passed, save with content_id filename
        filename = f"{request.content_id}.jpg" if request.content_id else f"{uuid.uuid4()}.jpg"
        file_path = os.path.join(static_dir, filename)
        with open(file_path, "wb") as f:
            f.write(image_bytes)

        base_public_url = (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/")
        public_url = f"{base_public_url}/static/generated_images/{filename}"

        logger.info("Saved generated Cloudflare Flux image to %s (public_url: %s)", file_path, public_url)

        return GenerateImageResponse(
            success=True,
            image_url=data_uri,
            public_url=public_url,
            prompt=result["prompt"],
            model=result["model"],
            message="Branding image generated successfully with Cloudflare Flux-1-schnell!",
        )
    except Exception as exc:
        logger.exception("Cloudflare AI image generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cloudflare image generation failed: {str(exc)}",
        )
