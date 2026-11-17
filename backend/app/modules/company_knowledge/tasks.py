import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.modules.company_knowledge.models import WebsiteCrawlJob
# Register requested_by's foreign-key target in the worker's shared metadata.
from app.modules.identity.models import User as _User
from app.modules.company_knowledge.services.json_artifacts import (
    save_validated_crawl_json,
)
from app.modules.company_knowledge.services.output_validation import (
    validate_and_deduplicate,
)
from app.modules.company_knowledge.services.persistence import (
    persist_crawl_output,
)
from app.modules.company_knowledge.services.website_crawler import (
    discover_and_extract,
)
from app.modules.company_knowledge.services.website_validation import (
    WebsiteValidationError,
    validate_website,
)


logger = logging.getLogger(__name__)


def _mark_failed(
    job_id: UUID,
    code: str,
    message: str,
) -> None:
    with SessionLocal() as db:
        job = db.get(WebsiteCrawlJob, job_id)
        if job is None:
            logger.error("Website crawl job disappeared", extra={"job_id": str(job_id)})
            return
        job.status = "failed"
        job.error_code = code
        job.error_message = message[:2000]
        job.finished_at = datetime.now(timezone.utc)
        db.commit()


@celery_app.task(
    name="company_knowledge.crawl_website",
    acks_late=True,
    reject_on_worker_lost=True,
)
def crawl_website_task(job_id: str) -> dict[str, str]:
    parsed_job_id = UUID(job_id)
    with SessionLocal() as db:
        job = db.get(WebsiteCrawlJob, parsed_job_id)
        if job is None:
            raise ValueError("Website crawl job not found.")
        if job.status in {"completed", "failed"}:
            return {"job_id": job_id, "status": job.status}

        job.status = "running"
        job.error_code = None
        job.error_message = None
        job.started_at = datetime.now(timezone.utc)
        job.finished_at = None
        db.commit()
        website_url = job.website_url
        sitemap_urls = list(job.sitemap_urls or [])

    try:
        validated_website = asyncio.run(validate_website(website_url))
        if sitemap_urls:
            validated_website = type(validated_website)(
                website_url=validated_website.website_url,
                host=validated_website.host,
                sitemap_available=(
                    validated_website.sitemap_available
                ),
                sitemap_urls=list(
                    dict.fromkeys(
                        [*validated_website.sitemap_urls, *sitemap_urls]
                    )
                ),
                robots_text=validated_website.robots_text,
            )
        output = asyncio.run(discover_and_extract(validated_website))
        output = validate_and_deduplicate(
            output,
            allowed_host=validated_website.host,
        )
        output, artifact_path = save_validated_crawl_json(
            output,
            job_id=parsed_job_id,
            output_dir=settings.CRAWL_JSON_OUTPUT_DIR,
        )

        with SessionLocal() as db:
            job = db.get(WebsiteCrawlJob, parsed_job_id)
            if job is None:
                raise ValueError("Website crawl job not found.")
            job.website_url = validated_website.website_url
            job.sitemap_available = validated_website.sitemap_available
            persist_crawl_output(db, job, output)
            status = job.status

        logger.info(
            "Website crawl pipeline finished",
            extra={
                "job_id": job_id,
                "status": status,
                "json_artifact": str(artifact_path),
            },
        )
        return {"job_id": job_id, "status": status}

    except WebsiteValidationError as exc:
        _mark_failed(parsed_job_id, exc.code, exc.message)
        logger.warning(
            "Website crawl validation failed",
            extra={"job_id": job_id, "error_code": exc.code},
        )
        return {"job_id": job_id, "status": "failed"}
    except (SQLAlchemyError, ValueError):
        logger.exception("Website crawl pipeline failed", extra={"job_id": job_id})
        _mark_failed(
            parsed_job_id,
            "pipeline_failed",
            "The crawl pipeline could not complete. Check backend logs for details.",
        )
        raise
    except Exception:
        logger.exception("Unexpected website crawl pipeline failure", extra={"job_id": job_id})
        _mark_failed(
            parsed_job_id,
            "pipeline_failed",
            "The crawl pipeline could not complete. Check backend logs for details.",
        )
        raise
