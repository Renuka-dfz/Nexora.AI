"""Recraft V4.1 Flash V2 image generation client."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

RECRAFT_GENERATIONS_URL = "https://external.api.recraft.ai/v1/images/generations"
RECRAFT_IMAGE_MODEL = "recraftv4_1_flash_v2"


class RecraftImageClient:
    """Generate raster images through Recraft's image generation API."""

    def __init__(self) -> None:
        self.api_token = (settings.RECRAFT_API_TOKEN or "").strip()
        self.model = RECRAFT_IMAGE_MODEL

    @property
    def is_configured(self) -> bool:
        return bool(self.api_token)

    async def generate_branding_image(
        self,
        prompt: str,
        *,
        company_name: str = "Nexora",
        topic: str | None = None,
        custom_style: str | None = None,
        size: str = "1:1",
    ) -> dict[str, Any]:
        if not self.is_configured:
            raise RuntimeError("Recraft is not configured. Set RECRAFT_API_TOKEN in .env.")

        prompt_parts = [f"Create a professional marketing image for {company_name}."]
        if topic:
            prompt_parts.append(f"Topic: {topic}.")
        prompt_parts.append(prompt.strip())
        if custom_style:
            prompt_parts.append(f"Visual direction: {custom_style.strip()}.")
        optimized_prompt = " ".join(part for part in prompt_parts if part)

        payload = {
            "model": self.model,
            "prompt": optimized_prompt,
            "size": size,
            "image_format": "png",
            "response_format": "b64_json",
        }
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=15.0)) as client:
            response = await client.post(RECRAFT_GENERATIONS_URL, headers=headers, json=payload)
            if response.is_error:
                logger.error("Recraft image generation failed with HTTP %s: %s", response.status_code, response.text)
                response.raise_for_status()
            result = response.json()

        image_data = (result.get("data") or [{}])[0].get("b64_json")
        if not image_data:
            raise RuntimeError("Recraft did not return image data.")

        return {
            "image_data_uri": f"data:image/png;base64,{image_data}",
            "prompt": optimized_prompt,
            "model": self.model,
        }
