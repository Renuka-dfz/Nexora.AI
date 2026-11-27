"""OpenRouter Image Generation Client for recraft/recraft-v3 and other vision models."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_MODEL = "recraft/recraft-v3"


class OpenRouterImageClient:
    """Generate high-impact marketing visuals through OpenRouter."""

    def __init__(self, model: str | None = None) -> None:
        self.api_key = (settings.OPENROUTER_API_KEY or "").strip()
        self.model = model or getattr(settings, "OPENROUTER_IMAGE_MODEL", None) or DEFAULT_OPENROUTER_MODEL

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_branding_image(
        self,
        prompt: str,
        *,
        company_name: str = "Nexora",
        topic: str | None = None,
        headline: str | None = None,
        pillars: list[str] | None = None,
        custom_style: str | None = None,
        aspect_ratio: str = "4:5",
        size: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate a visual creative using OpenRouter recraft/recraft-v3.
        Incorporates company name, visual headline, and key solution pillars.
        """
        if not self.is_configured:
            raise RuntimeError("OpenRouter is not configured. Set OPENROUTER_API_KEY in .env.")

        # Map common size formats to standard aspect ratios
        ratio = aspect_ratio
        if size:
            if size in ("4:5", "1080x1350"):
                ratio = "4:5"
            elif size in ("16:9", "1200x627", "1200x675"):
                ratio = "16:9"
            elif size in ("1:1", "1080x1080"):
                ratio = "1:1"

        # Build an information-rich visual prompt
        prompt_parts: list[str] = [
            f"High-end corporate branded editorial marketing graphic for {company_name}."
        ]
        if headline:
            prompt_parts.append(f"Visual Title: {headline.strip()}.")
        elif topic:
            prompt_parts.append(f"Topic: {topic.strip()}.")

        if pillars:
            pillars_text = " | ".join(str(p).strip() for p in pillars if p)
            if pillars_text:
                prompt_parts.append(f"Core Capabilities & Value Pillars: {pillars_text}.")

        prompt_parts.append(prompt.strip())

        style_instruction = custom_style or (
            "clean modern corporate aesthetic, enterprise AI data intelligence, "
            "refined typography hierarchy, balanced visual composition, premium 3D graphic elements"
        )
        prompt_parts.append(f"Visual style: {style_instruction}.")

        optimized_prompt = " ".join(p for p in prompt_parts if p)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/"),
            "X-Title": "Nexora.AI Content Studio",
        }

        # 1. Primary: Dedicated OpenRouter Images endpoint (/api/v1/images)
        payload = {
            "model": self.model,
            "prompt": optimized_prompt,
            "aspect_ratio": ratio,
            "response_format": "b64_json",
            "responseFormat": "b64_json",
        }

        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=20.0)) as client:
            try:
                response = await client.post(OPENROUTER_IMAGES_URL, headers=headers, json=payload)
                if response.is_success:
                    data = response.json()
                    images = data.get("data") or []
                    if images:
                        b64_str = images[0].get("b64_json")
                        img_url = images[0].get("url")
                        if b64_str:
                            return {
                                "image_data_uri": f"data:image/png;base64,{b64_str}",
                                "image_bytes": base64.b64decode(b64_str),
                                "prompt": optimized_prompt,
                                "model": self.model,
                            }
                        elif img_url:
                            # Fetch image bytes from URL
                            img_resp = await client.get(img_url, timeout=30.0)
                            if img_resp.is_success:
                                raw_bytes = img_resp.content
                                encoded = base64.b64encode(raw_bytes).decode("ascii")
                                return {
                                    "image_data_uri": f"data:image/png;base64,{encoded}",
                                    "image_bytes": raw_bytes,
                                    "prompt": optimized_prompt,
                                    "model": self.model,
                                    "remote_url": img_url,
                                }
                logger.warning(
                    "OpenRouter /api/v1/images failed with HTTP %s: %s; attempting chat/completions fallback",
                    response.status_code,
                    response.text[:300],
                )
            except Exception as exc:
                logger.warning("OpenRouter /api/v1/images request error: %s; trying chat completions fallback", exc)

            # 2. Fallback: Chat Completions endpoint (for multimodal image models)
            chat_payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": optimized_prompt,
                    }
                ],
            }
            chat_resp = await client.post(OPENROUTER_CHAT_URL, headers=headers, json=chat_payload)
            if not chat_resp.is_success:
                logger.error("OpenRouter image generation failed: HTTP %s - %s", chat_resp.status_code, chat_resp.text)
                chat_resp.raise_for_status()

            chat_data = chat_resp.json()
            choices = chat_data.get("choices") or []
            if not choices:
                raise RuntimeError(f"OpenRouter returned empty choices: {chat_data}")

            message = choices[0].get("message", {})
            content = message.get("content", "")

            # Check if OpenRouter embedded image URL or base64 in message content
            import re
            b64_match = re.search(r"data:image/[^;]+;base64,([A-Za-z0-9+/=]+)", str(content))
            url_match = re.search(r"https?://[^\s\)\"\']+\.(?:png|jpg|jpeg|webp)", str(content), re.IGNORECASE)

            if b64_match:
                raw_b64 = b64_match.group(1)
                return {
                    "image_data_uri": f"data:image/png;base64,{raw_b64}",
                    "image_bytes": base64.b64decode(raw_b64),
                    "prompt": optimized_prompt,
                    "model": self.model,
                }
            elif url_match:
                found_url = url_match.group(0)
                img_resp = await client.get(found_url, timeout=30.0)
                if img_resp.is_success:
                    raw_bytes = img_resp.content
                    encoded = base64.b64encode(raw_bytes).decode("ascii")
                    return {
                        "image_data_uri": f"data:image/png;base64,{encoded}",
                        "image_bytes": raw_bytes,
                        "prompt": optimized_prompt,
                        "model": self.model,
                        "remote_url": found_url,
                    }

            raise RuntimeError(f"Could not extract image from OpenRouter response: {str(content)[:200]}")
