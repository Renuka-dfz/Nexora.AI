import asyncio
import base64
import io
import logging
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.integrations.instagram.caption import clean_instagram_caption
from app.integrations.recraft.image_client import RecraftImageClient
from app.integrations.instagram.publishing import execute_full_instagram_publish
from app.integrations.instagram.client import InstagramAPIClient
from app.integrations.instagram.schemas import InstagramPublishRequest
from app.integrations.linkedin.client import LinkedInAPIClient
from app.integrations.linkedin.publishing import publish_linkedin_post
from app.integrations.linkedin.schemas import LinkedInPostRequest
from app.modules.company_knowledge.models import DimCompany
from app.modules.marketing.models import DimContent, DimContentGenerationBatch

logger = logging.getLogger(__name__)


def _hashtag_text(raw_text: str) -> str:
    import re
    match = re.search(r"###\s*HASHTAGS\s*\n([\s\S]*?)(?=\n###|\Z)", raw_text or "", re.IGNORECASE)
    if not match:
        matches = re.findall(r"#[\w]+", raw_text or "")
        return " ".join(dict.fromkeys(matches))
    return " ".join(
        tag if tag.startswith("#") else f"#{tag}"
        for tag in re.findall(r"#?[\w]+", match.group(1))
        if tag
    )


def _image_font(size: int, bold: bool = False):
    from PIL import ImageFont

    candidates = (
        ("C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf"),
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


def _wrap_image_text(draw, text: str, font, max_width: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
            if len(lines) == max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and len(" ".join(lines).split()) < len(words):
        while lines[-1] and draw.textbbox((0, 0), lines[-1] + "...", font=font)[2] > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + "..."
    return lines


def _save_branded_image(
    content_id: UUID,
    company_name: str,
    platform: str,
    result: dict,
    post_title: str,
    post_summary: str,
) -> str | None:
    data_uri = result.get("image_data_uri")
    if not data_uri:
        return None
    encoded = data_uri.split(",", 1)[1] if "," in data_uri else data_uri
    image_bytes = base64.b64decode(encoded)

    target_size = (1080, 1350) if platform == "instagram" else (1200, 627)
    from PIL import Image, ImageDraw, ImageOps

    with Image.open(io.BytesIO(image_bytes)) as source_image:
        image = ImageOps.fit(source_image.convert("RGB"), target_size, method=Image.Resampling.LANCZOS)
    image = image.convert("RGBA")

    width, height = target_size
    panel_width = int(width * (0.82 if platform == "instagram" else 0.66))
    fade_width = int(width * 0.2)
    gradient = Image.new("L", (width, 1))
    gradient.putdata([
        220 if x < panel_width else
        int(220 * (1 - (x - panel_width) / fade_width))
        if x < panel_width + fade_width else 0
        for x in range(width)
    ])
    gradient = gradient.resize((width, height))
    shade = Image.new("RGBA", target_size, (5, 17, 27, 0))
    shade.putalpha(gradient)
    image.alpha_composite(shade)

    draw = ImageDraw.Draw(image)
    margin = int(width * 0.055)
    label_font = _image_font(max(16, int(width * 0.018)), bold=True)
    title_font = _image_font(max(36, int(width * (0.052 if platform == "instagram" else 0.046))), bold=True)
    summary_font = _image_font(max(20, int(width * 0.022)))
    brand_font = _image_font(max(14, int(width * 0.016)), bold=True)

    draw.text((margin, int(height * 0.09)), "AI JOURNAL", fill=(255, 180, 55, 255), font=label_font)
    brand = company_name.strip().upper()[:32]
    brand_width = draw.textbbox((0, 0), brand, font=brand_font)[2]
    draw.text((width - margin - brand_width, int(height * 0.09)), brand, fill=(255, 255, 255, 235), font=brand_font)
    draw.rounded_rectangle(
        (margin, int(height * 0.29), margin + int(width * 0.08), int(height * 0.29) + 5),
        radius=2,
        fill=(255, 142, 35, 255),
    )

    text_width = panel_width - margin * 2
    title_lines = _wrap_image_text(draw, post_title[:120], title_font, text_width, 4)
    title_y = int(height * 0.35)
    line_height = int(title_font.size * 1.12)
    for line_index, line in enumerate(title_lines):
        draw.text(
            (margin, title_y + line_index * line_height),
            line,
            fill=(255, 168, 50, 255) if line_index == 1 else (255, 255, 255, 255),
            font=title_font,
        )

    summary_y = title_y + len(title_lines) * line_height + int(height * 0.035)
    summary_lines = _wrap_image_text(draw, post_summary[:220], summary_font, text_width, 3)
    summary_line_height = int(summary_font.size * 1.45)
    for line_index, line in enumerate(summary_lines):
        draw.text(
            (margin, summary_y + line_index * summary_line_height),
            line,
            fill=(220, 229, 235, 255),
            font=summary_font,
        )

    output = io.BytesIO()
    image.convert("RGB").save(output, format="JPEG", quality=92)
    image_bytes = output.getvalue()

    static_dir = os.path.join(os.getcwd(), "static", "generated_images")
    os.makedirs(static_dir, exist_ok=True)
    filename = f"{content_id}.jpg"
    file_path = os.path.join(static_dir, filename)
    with open(file_path, "wb") as handle:
        handle.write(image_bytes)
    public_url = (settings.PUBLIC_APP_URL or "http://localhost:8000").rstrip("/")
    return f"{public_url}/static/generated_images/{filename}"


@celery_app.task(
    name="marketing.generate_weekly_batch",
    bind=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def generate_weekly_batch_task(
    self,
    batch_id: str,
    content_type: str = "post",
    instructions: str | None = None,
    tone: str | None = None,
) -> dict:
    parsed_batch_id = UUID(batch_id)
    with SessionLocal() as db:
        batch = db.get(DimContentGenerationBatch, parsed_batch_id)
        if batch is None:
            raise ValueError("Generation batch not found")
        if batch.status in {"completed", "partial"}:
            return {"batch_id": batch_id, "status": batch.status}
        platform = batch.platform
        batch.status = "generating"
        batch.error_message = None
        db.commit()
        company = db.get(DimCompany, batch.company_id)
        company_name = company.company_name if company else "DataFactZ"

    fixed_topics = [
        "Enterprise AI Agents: Autonomous Partner Data Intake & Reconciliation",
        "Governed Data Foundations: Enterprise Semantic Architecture & Unified Models",
        "Power BI Migrations: Modern BI Modernization & Automated Schema Migration",
        "Field Intelligence Agents: Automated Extraction from Unstructured Service Records",
        "Incentive Compensation Optimization: Deterministic AI Calculation for Enterprise Sales",
    ]

    created_count = 0
    image_failures = 0
    now = datetime.now(timezone.utc)
    first_schedule = now.replace(hour=10, minute=0, second=0, microsecond=0)
    if first_schedule <= now:
        first_schedule += timedelta(days=1)

    from app.agents.marketing_agent.graph import build_marketing_agent_graph

    for index, fixed_topic in enumerate(fixed_topics):
        try:
            with SessionLocal() as db:
                batch = db.get(DimContentGenerationBatch, parsed_batch_id)
                if batch is None:
                    break
                graph = build_marketing_agent_graph(db)
                topic_focus = batch.prompt.strip() if batch.prompt and batch.prompt.strip() else ""
                post_topic = f"{topic_focus} — {fixed_topic}" if topic_focus else fixed_topic
                generation_instructions = [
                    f"Generate post {index + 1} of 5 focused on: {fixed_topic}.",
                    "Use only verified PostgreSQL company knowledge.",
                ]
                if instructions and instructions.strip():
                    generation_instructions.append(instructions.strip())
                initial_state = {
                    "company_id": batch.company_id,
                    "user_id": batch.user_id,
                    "topic": post_topic,
                    "platform": batch.platform,
                    "content_type": content_type,
                    "tone": tone or "authoritative yet accessible",
                    "instructions": "\n".join(generation_instructions),
                    "multi_stage": False,
                    "is_article": content_type == "article",
                }
                result = graph.invoke(initial_state)
                content_id = result.get("content_id")
                if not content_id:
                    continue
                content = db.get(DimContent, UUID(str(content_id)))
                if content is None:
                    continue
                content.generation_batch_id = parsed_batch_id
                content.topic = post_topic
                content.caption = clean_instagram_caption(content.content_text) if batch.platform == "instagram" else content.content_text
                content.hashtags = _hashtag_text(content.content_text)
                content.scheduled_at = first_schedule + timedelta(days=index)
                content.approval_status = "pending"
                content.publish_status = "draft"
                image_title = content.content_title
                image_summary = (content.caption or content.content_text).split("\n", 1)[0].strip()
                db.commit()

            from app.modules.marketing.image_service import generate_and_save_marketing_image
            brief_data = result.get("creative_brief") or {}
            bullet_matches = re.findall(r"(?:•|\*|-)\s*(\*\*[^*]+\*\*:[^\n]+|[^\n]+)", content.content_text or "")
            pillars_val = brief_data.get("key_points") or (bullet_matches[:3] if bullet_matches else [
                "Understand complex data",
                "Automate repeatable tasks",
                "Keep humans in control",
            ])

            try:
                public_url, provider_used, err = asyncio.run(generate_and_save_marketing_image(
                    UUID(str(content_id)),
                    topic=post_topic,
                    headline=image_title,
                    subheadline=brief_data.get("subheadline") or "Enterprise workflows with people in control.",
                    pillars=pillars_val,
                    platform=platform,
                    company_name=company_name,
                    brief=brief_data,
                ))
                if not public_url:
                    image_failures += 1
            except Exception:
                image_failures += 1
                logger.exception("Image generation failed for batch %s post %s", batch_id, content_id)

            created_count += 1
        except Exception:
            logger.exception("Post generation failed for batch %s index %s", batch_id, index)

    final_status = "failed"
    with SessionLocal() as db:
        batch = db.get(DimContentGenerationBatch, parsed_batch_id)
        if batch:
            batch.total_created = created_count
            if created_count == 5 and image_failures == 0:
                batch.status = "completed"
            elif created_count > 0:
                batch.status = "partial"
            else:
                batch.status = "failed"
            if image_failures:
                batch.error_message = f"{image_failures} image(s) failed. Text posts were saved and can be retried."
            elif created_count < 5:
                batch.error_message = f"Generated {created_count} of 5 requested posts."
            batch.completed_at = datetime.now(timezone.utc)
            final_status = batch.status
            db.commit()
    return {"batch_id": batch_id, "status": final_status, "total_created": created_count}


@celery_app.task(
    name="marketing.publish_scheduled_posts",
    acks_late=True,
    reject_on_worker_lost=True,
)
def publish_scheduled_posts_task() -> dict:
    now = datetime.now(timezone.utc)
    published_count = 0
    failed_count = 0
    with SessionLocal() as db:
        posts = db.scalars(
            select(DimContent).where(
                DimContent.approval_status == "approved",
                DimContent.publish_status == "scheduled",
                DimContent.scheduled_at.is_not(None),
                DimContent.scheduled_at <= now,
            )
        ).all()

        for post in posts:
            post.publish_status = "publishing"
            db.commit()

            try:
                if post.platform_target == "instagram":
                    token = (settings.IG_ACCESS_TOKEN or "").strip()
                    user_id = (settings.IG_USER_ID or "").strip()
                    if not token or not user_id or not post.image_url:
                        raise RuntimeError("Instagram credentials or generated image are unavailable")
                    caption = (post.caption or clean_instagram_caption(post.content_text)).strip()[:2200]
                    result = asyncio.run(execute_full_instagram_publish(
                        InstagramAPIClient(access_token=token),
                        InstagramPublishRequest(instagram_user_id=user_id, caption=caption, image_url=post.image_url),
                    ))
                    platform_post_id = result.media_id
                else:
                    token = (settings.LINKEDIN_ACCESS_TOKEN or "").strip()
                    author_urn = (settings.LINKEDIN_ORGANIZATION_URN or "").strip()
                    if not token:
                        raise RuntimeError("LinkedIn credentials are unavailable")
                    result = asyncio.run(publish_linkedin_post(
                        LinkedInAPIClient(access_token=token),
                        LinkedInPostRequest(
                            author_urn=author_urn or "urn:li:organization:datafactz",
                            commentary=post.content_text[:3000],
                            title=post.content_title,
                        ),
                    ))
                    platform_post_id = result.post_urn

                post.publish_status = "published"
                post.published_post_id = platform_post_id
                post.published_at = datetime.now(timezone.utc)
                post.publish_error = None
                db.commit()
                published_count += 1
            except Exception as exc:
                logger.exception("Scheduled publishing failed for content %s", post.content_id)
                post.publish_status = "failed"
                post.publish_error = str(exc)[:2000]
                db.commit()
                failed_count += 1
    return {"published": published_count, "failed": failed_count}


@celery_app.task(
    name="marketing.auto_generate_weekly_campaigns",
    acks_late=True,
    reject_on_worker_lost=True,
)
def auto_generate_weekly_campaigns_task() -> dict:
    """
    Weekly background task executed by Celery Beat.
    Creates a weekly 5-post content generation batch for all active companies.
    All generated posts are created with approval_status='pending' for user review.
    """
    from app.modules.company_knowledge.models import DimCompany
    from app.modules.identity.models import User
    from sqlalchemy import select

    created_batches = []
    with SessionLocal() as db:
        companies = db.scalars(select(DimCompany)).all()

        for company in companies:
            admin_user = db.scalars(
                select(User).where(
                    User.company_id == company.company_id,
                    User.is_active == True,
                ).order_by(User.created_at.asc())
            ).first()

            if not admin_user:
                continue

            batch = DimContentGenerationBatch(
                company_id=company.company_id,
                user_id=admin_user.user_id,
                platform="linkedin",
                mode="weekly_plan",
                status="queued",
                prompt="Weekly enterprise thought leadership & capability series",
                total_requested=5,
                total_created=0,
            )
            db.add(batch)
            db.flush()
            created_batches.append(str(batch.batch_id))

        db.commit()

    for batch_id in created_batches:
        try:
            generate_weekly_content_batch_task.delay(batch_id)
            logger.info("Enqueued weekly content generation for batch %s", batch_id)
        except Exception as exc:
            logger.error("Failed to enqueue batch %s: %s", batch_id, exc)

    return {"batches_created": len(created_batches), "batch_ids": created_batches}
