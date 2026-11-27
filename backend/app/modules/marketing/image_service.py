"""
Unified Image Generation Service for Nexora.AI & DataFactZ Marketing.

Used identically by:
1. Content Studio (manual generation)
2. Celery Worker (weekly batch generation)

Provides:
- OpenRouter recraft/recraft-v3 integration with dynamic structured prompts
- Pillow-based deterministic branding & typography composition
- Guaranteed local infographic rendering fallback (never returns empty black box)
- Atomic storage to static/generated_images and database URL persistence
"""

from __future__ import annotations

import asyncio
import base64
import io
import logging
import os
import re
from typing import Any
from uuid import UUID

from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy.orm import Session

from app.agents.marketing_agent.brand import DATAFACTZ_BRAND_PALETTE, get_company_brand_config
from app.agents.marketing_agent.image_prompt_builder import build_image_prompt
from app.agents.marketing_agent.schemas import MarketingCreativeBrief
from app.core.config import settings
from app.core.database import SessionLocal
from app.integrations.openrouter.image_client import OpenRouterImageClient
from app.integrations.recraft.image_client import RecraftImageClient
from app.modules.marketing.models import DimContent

logger = logging.getLogger(__name__)


def _get_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    """Safely obtain system true-type font or default."""
    candidates = (
        ("C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf"),
        ("C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf"),
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int, max_lines: int = 4) -> list[str]:
    """Wrap text to fit within pixel boundary."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) >= max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    return lines


def generate_local_infographic_canvas(
    target_size: tuple[int, int],
    company_name: str,
    headline: str,
    subheadline: str,
    pillars: list[str],
    platform: str = "instagram",
) -> bytes:
    """
    Render a deterministic high-resolution DataFactZ editorial infographic card using Pillow.
    Ensures that even if external APIs are unconfigured or fail, the post receives an actual,
    professional, high-contrast, informative visual asset.
    """
    width, height = target_size
    img = Image.new("RGBA", (width, height), (24, 33, 39, 255))  # #182127 Dark Charcoal
    draw = ImageDraw.Draw(img)

    # Accent decorative background gradient/grid
    grid_color = (33, 46, 54, 255)
    for x in range(0, width, 60):
        draw.line([(x, 0), (x, height)], fill=grid_color, width=1)
    for y in range(0, height, 60):
        draw.line([(0, y), (width, y)], fill=grid_color, width=1)

    # Subtle ambient gradient overlay
    ambient = Image.new("RGBA", (width, height), (0, 164, 239, 0))
    amb_draw = ImageDraw.Draw(ambient)
    amb_draw.ellipse(
        [(width - 300, -100), (width + 300, 500)],
        fill=(0, 164, 239, 25),  # Soft cyan ambient glow
    )
    amb_draw.ellipse(
        [(-150, height - 350), (450, height + 250)],
        fill=(255, 185, 0, 20),   # Soft amber glow
    )
    img.alpha_composite(ambient)
    draw = ImageDraw.Draw(img)

    margin = int(width * 0.08)
    content_width = width - (margin * 2)

    # 1. Header: Brand Wordmark & Tagline
    brand_font = _get_font(int(width * 0.032), bold=True)
    draw.text((margin, int(height * 0.06)), company_name.upper(), fill=(255, 255, 255, 255), font=brand_font)

    badge_text = "ENTERPRISE AI & DATA"
    badge_font = _get_font(int(width * 0.016), bold=True)
    draw.rounded_rectangle(
        [(width - margin - 200, int(height * 0.06)), (width - margin, int(height * 0.06) + 32)],
        radius=8,
        fill=(0, 164, 239, 45),
        outline=(0, 164, 239, 180),
        width=1,
    )
    draw.text((width - margin - 190, int(height * 0.06) + 7), badge_text, fill=(0, 164, 239, 255), font=badge_font)

    # Accent separator bar
    draw.rounded_rectangle(
        [(margin, int(height * 0.12)), (margin + 80, int(height * 0.12) + 4)],
        radius=2,
        fill=(255, 185, 0, 255),  # Warm amber accent
    )

    # 2. Main Headline
    title_font = _get_font(int(width * 0.052), bold=True)
    title_lines = _wrap_text(draw, headline, title_font, content_width, max_lines=3)
    curr_y = int(height * 0.15)
    line_h = int(title_font.size * 1.2)
    for line in title_lines:
        draw.text((margin, curr_y), line, fill=(255, 255, 255, 255), font=title_font)
        curr_y += line_h

    # 3. Subheadline
    subhead_font = _get_font(int(width * 0.024), bold=False)
    subhead_lines = _wrap_text(draw, subheadline, subhead_font, content_width, max_lines=2)
    curr_y += 12
    sub_line_h = int(subhead_font.size * 1.35)
    for line in subhead_lines:
        draw.text((margin, curr_y), line, fill=(203, 213, 225, 255), font=subhead_font)
        curr_y += sub_line_h

    # 4. Pillar / Key Point Cards
    curr_y += int(height * 0.04)
    card_h = int(height * 0.11)
    card_font = _get_font(int(width * 0.024), bold=True)
    num_font = _get_font(int(width * 0.026), bold=True)

    items = pillars[:3] if pillars else ["Understand complex data", "Automate repeatable tasks", "Keep humans in control"]
    for i, item in enumerate(items):
        card_box = [(margin, curr_y), (margin + content_width, curr_y + card_h)]
        draw.rounded_rectangle(
            card_box,
            radius=12,
            fill=(31, 43, 51, 230),  # Card background
            outline=(42, 59, 71, 255),
            width=1,
        )

        # Number badge (01, 02, 03)
        num_str = f"0{i+1}"
        draw.rounded_rectangle(
            [(margin + 18, curr_y + 16), (margin + 62, curr_y + card_h - 16)],
            radius=8,
            fill=(0, 164, 239, 40),
            outline=(0, 164, 239, 120),
            width=1,
        )
        draw.text((margin + 26, curr_y + int((card_h - num_font.size) / 2) - 3), num_str, fill=(0, 164, 239, 255), font=num_font)

        # Clean text
        clean_text = re.sub(r"^(?:Pillar \d+:?|\d+\.?)\s*", "", item).strip()
        pillar_lines = _wrap_text(draw, clean_text, card_font, content_width - 100, max_lines=2)
        text_y = curr_y + int((card_h - (len(pillar_lines) * int(card_font.size * 1.25))) / 2)
        for pline in pillar_lines:
            draw.text((margin + 80, text_y), pline, fill=(255, 255, 255, 255), font=card_font)
            text_y += int(card_font.size * 1.25)

        curr_y += card_h + 16

    # 5. Footer Signature
    footer_font = _get_font(int(width * 0.018), bold=False)
    footer_text = "DataFactZ • Production AI Agents & Governed Data Foundations"
    draw.text((margin, height - int(height * 0.06)), footer_text, fill=(148, 163, 184, 255), font=footer_font)

    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=94)
    return buf.getvalue()


async def generate_and_save_marketing_image(
    content_id: UUID,
    *,
    topic: str,
    headline: str,
    subheadline: str | None = None,
    pillars: list[str] | None = None,
    platform: str = "instagram",
    company_name: str = "DataFactZ",
    brief: MarketingCreativeBrief | dict[str, Any] | None = None,
    custom_style: str | None = None,
    db: Session | None = None,
) -> tuple[str | None, str, str | None]:
    """
    Unified entry point for image generation.
    Returns: (public_url, status, error_message)
    """
    subhead_val = subheadline or "Enterprise workflows with people in control."
    pillars_val = pillars or ["Understand complex data", "Automate repeatable tasks", "Keep humans in control"]
    target_size = (1080, 1350) if platform == "instagram" else (1200, 627)

    # Build rich dynamic prompt
    prompt = build_image_prompt(
        brief=brief or {
            "headline": headline,
            "subheadline": subhead_val,
            "key_points": pillars_val,
            "visual_concept": f"Enterprise workflow diagram illustrating {topic}",
            "layout_type": "process_flow" if "agent" in topic.lower() else "infographic",
            "topic": topic,
        },
        platform=platform,
        company_name=company_name,
    )

    openrouter_client = OpenRouterImageClient()
    recraft_client = RecraftImageClient()
    image_bytes: bytes | None = None
    provider_used: str = "local_infographic"
    err_msg: str | None = None

    # Priority 1: OpenRouter (recraft/recraft-v3)
    if openrouter_client.is_configured:
        try:
            logger.info("Generating creative via OpenRouter (%s) for content %s", openrouter_client.model, content_id)
            result = await openrouter_client.generate_branding_image(
                prompt=prompt,
                company_name=company_name,
                topic=topic,
                headline=headline,
                pillars=pillars_val,
                custom_style=custom_style,
                size="4:5" if platform == "instagram" else "16:9",
            )
            raw_bytes = result.get("image_bytes")
            if raw_bytes:
                # Composite text & branding onto the OpenRouter artwork
                with Image.open(io.BytesIO(raw_bytes)) as source_img:
                    fitted = ImageOps.fit(source_img.convert("RGB"), target_size, method=Image.Resampling.LANCZOS)
                    # Overlay subtle bottom typography card
                    draw = ImageDraw.Draw(fitted)
                    overlay = Image.new("RGBA", target_size, (0, 0, 0, 0))
                    ov_draw = ImageDraw.Draw(overlay)
                    ov_draw.rectangle([(0, int(target_size[1] * 0.72)), (target_size[0], target_size[1])], fill=(15, 23, 28, 220))
                    fitted_rgba = fitted.convert("RGBA")
                    fitted_rgba.alpha_composite(overlay)

                    f_draw = ImageDraw.Draw(fitted_rgba)
                    h_font = _get_font(int(target_size[0] * 0.04), bold=True)
                    s_font = _get_font(int(target_size[0] * 0.022), bold=False)
                    margin = int(target_size[0] * 0.07)
                    f_draw.text((margin, int(target_size[1] * 0.75)), headline[:80], fill=(255, 255, 255, 255), font=h_font)
                    f_draw.text((margin, int(target_size[1] * 0.82)), subhead_val[:110], fill=(203, 213, 225, 255), font=s_font)
                    f_draw.text((margin, int(target_size[1] * 0.92)), f"{company_name.upper()} • AI AGENTS IN PRODUCTION", fill=(0, 164, 239, 255), font=_get_font(int(target_size[0] * 0.018), bold=True))

                    out_buf = io.BytesIO()
                    fitted_rgba.convert("RGB").save(out_buf, format="JPEG", quality=92)
                    image_bytes = out_buf.getvalue()
                    provider_used = f"openrouter:{openrouter_client.model}"
        except Exception as exc:
            logger.warning("OpenRouter image generation failed: %s; invoking local infographic engine", exc)
            err_msg = str(exc)

    # Priority 2: Recraft direct if configured
    if image_bytes is None and recraft_client.is_configured:
        try:
            logger.info("Generating creative via Recraft for content %s", content_id)
            recraft_res = await recraft_client.generate_branding_image(
                prompt=prompt,
                company_name=company_name,
                topic=topic,
                size="4:5" if platform == "instagram" else "16:9",
            )
            raw_uri = recraft_res.get("image_data_uri", "")
            if raw_uri:
                b64 = raw_uri.split(",", 1)[1] if "," in raw_uri else raw_uri
                image_bytes = base64.b64decode(b64)
                provider_used = "recraft"
        except Exception as exc:
            logger.warning("Recraft image generation failed: %s", exc)
            err_msg = str(exc)

    # Priority 3: Guaranteed Local Infographic Canvas (Never leaves post empty)
    if image_bytes is None:
        logger.info("Rendering deterministic local DataFactZ infographic canvas for content %s", content_id)
        image_bytes = generate_local_infographic_canvas(
            target_size=target_size,
            company_name=company_name,
            headline=headline,
            subheadline=subhead_val,
            pillars=pillars_val,
            platform=platform,
        )
        provider_used = "local_infographic_renderer"

    # Save to disk
    static_dir = os.path.join(os.getcwd(), "backend", "static", "generated_images")
    if not os.path.exists(static_dir):
        static_dir = os.path.join(os.getcwd(), "static", "generated_images")
    os.makedirs(static_dir, exist_ok=True)

    filename = f"{content_id}.jpg"
    file_path = os.path.join(static_dir, filename)
    with open(file_path, "wb") as f:
        f.write(image_bytes)

    base_public_url = (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/")
    public_url = f"{base_public_url}/static/generated_images/{filename}"

    # Persist to database if Session provided or via SessionLocal
    def _update_db(session: Session):
        item = session.get(DimContent, content_id)
        if item:
            item.image_url = public_url
            session.commit()

    if db:
        _update_db(db)
    else:
        with SessionLocal() as session:
            _update_db(session)

    logger.info("Successfully saved and attached marketing image %s to content %s (provider: %s)", public_url, content_id, provider_used)
    return public_url, provider_used, err_msg
