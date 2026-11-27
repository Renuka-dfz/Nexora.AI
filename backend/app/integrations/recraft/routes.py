"""API endpoints for Recraft-generated marketing images."""

from __future__ import annotations

import base64
import logging
import os
import uuid
from io import BytesIO
from typing import Literal, Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from PIL import Image
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
from app.integrations.recraft.image_client import RECRAFT_IMAGE_MODEL, RecraftImageClient
from app.modules.identity.models import User
from app.modules.marketing.models import DimContent

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/integrations/recraft",
    tags=["Recraft Image Generation"],
)


class GenerateImageRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=1500)
    topic: Optional[str] = None
    company_name: Optional[str] = "Nexora"
    custom_style: Optional[str] = None
    content_id: Optional[UUID] = None
    size: Literal["1:1", "4:5", "16:9"] = "1:1"


class GenerateImageResponse(BaseModel):
    success: bool
    image_url: str
    public_url: Optional[str] = None
    prompt: str
    model: str
    message: str


@router.post("/generate-image", response_model=GenerateImageResponse)
async def generate_brand_image(
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

    image_client = RecraftImageClient()
    if not image_client.is_configured:
        # Transparent fallback to OpenRouter (recraft/recraft-v3) if configured
        from app.integrations.openrouter.image_client import OpenRouterImageClient
        openrouter_client = OpenRouterImageClient()
        if openrouter_client.is_configured:
            result = await openrouter_client.generate_branding_image(
                prompt=request.prompt,
                company_name=request.company_name or "Nexora",
                topic=request.topic,
                custom_style=request.custom_style,
                size=request.size,
            )
            image_bytes = result["image_bytes"]
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
            return GenerateImageResponse(
                success=True,
                image_url=result.get("image_data_uri", public_url),
                public_url=public_url,
                prompt=result.get("prompt", request.prompt),
                model=openrouter_client.model,
                message=f"Image generated successfully via OpenRouter ({openrouter_client.model})",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Neither Recraft nor OpenRouter is configured. Set OPENROUTER_API_KEY in .env.",
        )

    file_path: Optional[str] = None
    try:
        result = await image_client.generate_branding_image(
            prompt=request.prompt,
            company_name=request.company_name or "Nexora",
            topic=request.topic,
            custom_style=request.custom_style,
            size=request.size,
        )
        data_uri = result["image_data_uri"]
        encoded_image = data_uri.split(",", 1)[1] if "," in data_uri else data_uri
        image_bytes = base64.b64decode(encoded_image, validate=True)

        static_dir = os.path.join(os.getcwd(), "static", "generated_images")
        os.makedirs(static_dir, exist_ok=True)
        filename = f"{request.content_id}_{uuid.uuid4().hex}.jpg" if request.content_id else f"{uuid.uuid4()}.jpg"
        file_path = os.path.join(static_dir, filename)
        with Image.open(BytesIO(image_bytes)) as generated_image:
            generated_image.convert("RGB").save(file_path, format="JPEG", quality=92)

        base_public_url = (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/")
        public_url = f"{base_public_url}/static/generated_images/{filename}"
        if content is not None:
            content.image_url = public_url
        logger.info("Saved Recraft image to %s", file_path)
    except (httpx.HTTPError, OSError, RuntimeError, KeyError, TypeError, ValueError) as exc:
        logger.exception("Recraft image generation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Recraft image generation failed: {str(exc)}",
        ) from exc

    if content is not None:
        try:
            db.commit()
            db.refresh(content)
        except SQLAlchemyError as exc:
            db.rollback()
            if file_path:
                try:
                    os.remove(file_path)
                except FileNotFoundError:
                    pass
                except OSError:
                    logger.warning("Could not remove orphaned generated image %s", file_path, exc_info=True)
            logger.exception("Could not save generated image URL for content %s", content.content_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Image generated, but its URL could not be saved to the content item.",
            ) from exc

    return GenerateImageResponse(
        success=True,
        image_url=data_uri,
        public_url=public_url,
        prompt=result["prompt"],
        model=result.get("model", RECRAFT_IMAGE_MODEL),
        message="Image generated successfully with Recraft V4.1 Flash V2.",
    )
