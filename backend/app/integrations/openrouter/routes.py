"""API endpoints for OpenRouter-generated marketing images (recraft/recraft-v3)."""

from __future__ import annotations

import logging
import os
import uuid
from io import BytesIO
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from PIL import Image
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
from app.integrations.openrouter.image_client import OpenRouterImageClient
from app.modules.identity.models import User
from app.modules.marketing.models import DimContent

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations/openrouter",
    tags=["OpenRouter Image Generation"],
)


class GenerateImageRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    topic: Optional[str] = None
    company_name: Optional[str] = "DataFactZ"
    headline: Optional[str] = None
    pillars: Optional[list[str]] = None
    custom_style: Optional[str] = None
    content_id: Optional[UUID] = None
    size: Literal["1:1", "4:5", "16:9"] = "4:5"


class GenerateImageResponse(BaseModel):
    success: bool
    image_url: str
    public_url: Optional[str] = None
    prompt: str
    model: str
    message: str


@router.post("/generate-image", response_model=GenerateImageResponse)
async def generate_openrouter_image(
    request: GenerateImageRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = None
    if request.content_id:
        content = db.get(DimContent, request.content_id)
        if content is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Content item not found")
        ensure_company_access(db, user, content.company_id, allowed_roles=("admin", "user"))
        if content.approval_status not in ("draft", "rejected"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An image cannot be changed after content is submitted for review",
            )

    client = OpenRouterImageClient()
    if not client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OpenRouter is not configured. Set OPENROUTER_API_KEY in .env.",
        )

    file_path: Optional[str] = None
    try:
        result = await client.generate_branding_image(
            prompt=request.prompt,
            company_name=request.company_name or "DataFactZ",
            topic=request.topic,
            headline=request.headline,
            pillars=request.pillars,
            custom_style=request.custom_style,
            aspect_ratio=request.size,
        )

        image_bytes = result.get("image_bytes")
        if not image_bytes:
            raise RuntimeError("No image data returned from OpenRouter.")

        static_dir = os.path.join(os.getcwd(), "backend", "static", "generated_images")
        if not os.path.exists(static_dir):
            static_dir = os.path.join(os.getcwd(), "static", "generated_images")
        os.makedirs(static_dir, exist_ok=True)

        filename = f"{request.content_id}_{uuid.uuid4().hex[:8]}.jpg" if request.content_id else f"{uuid.uuid4().hex[:12]}.jpg"
        file_path = os.path.join(static_dir, filename)

        with Image.open(BytesIO(image_bytes)) as generated_image:
            generated_image.convert("RGB").save(file_path, format="JPEG", quality=92)

        base_public_url = (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/")
        public_url = f"{base_public_url}/static/generated_images/{filename}"

        if content is not None:
            content.image_url = public_url
            db.commit()
            db.refresh(content)

        logger.info("Saved OpenRouter image to %s", file_path)

        return GenerateImageResponse(
            success=True,
            image_url=result.get("image_data_uri", public_url),
            public_url=public_url,
            prompt=result.get("prompt", request.prompt),
            model=client.model,
            message=f"Image generated successfully via OpenRouter ({client.model})",
        )
    except Exception as exc:
        logger.exception("OpenRouter image generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"OpenRouter image generation failed: {str(exc)}",
        ) from exc
