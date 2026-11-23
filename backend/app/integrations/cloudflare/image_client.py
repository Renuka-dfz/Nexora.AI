"""
Nexora.AI - Cloudflare Workers AI Text-to-Image Client.
Uses Black Forest Labs Flux-1-schnell (@cf/black-forest-labs/flux-1-schnell)
for enterprise marketing, promotional assets, and brand graphics.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

CLOUDFLARE_BASE_AI_URL = "https://api.cloudflare.com/client/v4/accounts"


class CloudflareImageClient:
    """Client for generating branding and promotional visuals via Cloudflare Workers AI."""

    def __init__(self) -> None:
        self.account_id = (settings.CLOUDFLARE_ACCOUNT_ID or "").strip()
        self.api_token = (settings.CLOUDFLARE_API_TOKEN or "").strip()
        self.model = (settings.CLOUDFLARE_IMAGE_MODEL or "@cf/black-forest-labs/flux-1-schnell").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.account_id and self.api_token)

    async def generate_branding_image(
        self,
        prompt: str,
        *,
        company_name: str = "DataFactZ",
        topic: Optional[str] = None,
        custom_style: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Generate a photorealistic or graphic promotional branding image using Flux-1-schnell on Cloudflare.
        """
        if not self.is_configured:
            raise RuntimeError(
                "Cloudflare AI is not configured. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env"
            )

        # Build high-aesthetic branding prompt
        brand_style = custom_style or (
            "clean minimal corporate technology aesthetic, dark graphite and slate background, "
            "subtle glowing accents, sharp architectural typography, photorealistic, 8k resolution, "
            "cinematic studio lighting, award-winning branding visual advertisement"
        )

        clean_topic = f" about {topic}" if topic else ""
        optimized_prompt = f"Professional corporate branding promotional graphic for {company_name}{clean_topic}: {prompt}. {brand_style}"

        url = f"{CLOUDFLARE_BASE_AI_URL}/{self.account_id}/ai/run/{self.model}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "prompt": optimized_prompt,
        }

        logger.info("Executing Cloudflare Workers AI Image Generation with model: %s", self.model)

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.error("Cloudflare AI error (%s): %s", resp.status_code, resp.text)
                resp.raise_for_status()

            data = resp.json()
            result = data.get("result", {})
            b64_image = result.get("image")
            if not b64_image:
                raise RuntimeError(f"Cloudflare Workers AI did not return an image payload: {data}")

            data_uri = f"data:image/jpeg;base64,{b64_image}"
            logger.info("Successfully generated image via Cloudflare Flux-1-schnell (%s chars)", len(b64_image))

            return {
                "image_data_uri": data_uri,
                "prompt": optimized_prompt,
                "model": self.model,
                "usage": result.get("usage", {}),
            }
