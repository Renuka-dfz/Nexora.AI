import hashlib
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    CrawledPage,
    DimCategory,
    DimSource,
    FactCompanyIntelligence,
    WebsiteCrawlJob,
)
from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
)


def _section_key(heading_path: str, title: str) -> str:
    return hashlib.sha256(
        f"{heading_path.casefold()}\0{title.casefold()}".encode("utf-8")
    ).hexdigest()


def persist_crawl_output(
    db: Session,
    job: WebsiteCrawlJob,
    output: CrawlPipelineOutput,
) -> tuple[int, int]:
    categories = {
        category.category_name.casefold(): category.category_id
        for category in db.scalars(select(DimCategory)).all()
    }
    default_category_id = categories.get("company overview")
    if default_category_id is None:
        raise ValueError(
            "Company knowledge categories are missing; apply the category seed migration."
        )

    root_source = db.get(DimSource, job.source_id)
    if root_source is None or root_source.company_id != job.company_id:
        raise ValueError("The crawl's company website source no longer exists.")

    now = datetime.now(timezone.utc)
    successful_pages = 0
    sections_saved = 0

    for extracted_page in output.pages:
        page_url = extracted_page.page_url
        source = db.scalar(
            select(DimSource).where(
                DimSource.company_id == job.company_id,
                DimSource.source_url == page_url,
            )
        )
        if source is None:
            source = DimSource(
                company_id=job.company_id,
                source_url=page_url,
                source_type="website",
            )
            db.add(source)
            db.flush()

        source.page_title = extracted_page.title
        source.last_crawled_at = now

        page = db.scalar(
            select(CrawledPage).where(
                CrawledPage.company_id == job.company_id,
                CrawledPage.page_url == page_url,
            )
        )
        if page is None:
            page = CrawledPage(
                company_id=job.company_id,
                page_url=page_url,
                source_id=source.source_id,
                last_job_id=job.job_id,
            )
            db.add(page)
            db.flush()

        page.source_id = source.source_id
        page.last_job_id = job.job_id
        page.title = extracted_page.title
        page.meta_description = extracted_page.meta_description
        page.raw_html = extracted_page.raw_html
        page.markdown_content = extracted_page.markdown_content
        page.metadata_json = extracted_page.metadata
        page.content_hash = extracted_page.metadata.get("content_hash")
        page.crawl_status = extracted_page.crawl_status
        page.error_message = extracted_page.error_message
        page.crawled_at = now

        if extracted_page.crawl_status != "success":
            continue

        successful_pages += 1
        if extracted_page.sections:
            db.execute(
                update(FactCompanyIntelligence)
                .where(FactCompanyIntelligence.page_id == page.page_id)
                .values(is_current=False)
            )

        seen_keys: set[str] = set()
        for section in extracted_page.sections:
            category_id = categories.get(
                section.category.casefold(),
                default_category_id,
            )
            key = _section_key(section.heading_path, section.title)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            fact = db.scalar(
                select(FactCompanyIntelligence).where(
                    FactCompanyIntelligence.page_id == page.page_id,
                    FactCompanyIntelligence.section_key == key,
                )
            )
            values = {
                "company_id": job.company_id,
                "category_id": category_id,
                "source_id": source.source_id,
                "page_id": page.page_id,
                "heading_path": section.heading_path,
                "section_order": section.section_order,
                "section_key": key,
                "title": section.title,
                "description": section.content,
                "verification_status": "pending",
                "is_current": True,
                "extracted_at": now,
            }
            if fact is None:
                db.add(FactCompanyIntelligence(**values))
            else:
                for field, value in values.items():
                    setattr(fact, field, value)
            sections_saved += 1

    job.pages_discovered = len(output.pages)
    job.pages_processed = successful_pages
    job.sections_saved = sections_saved
    job.finished_at = now

    if successful_pages == 0:
        job.status = "failed"
        job.error_code = "crawl_failed"
        job.error_message = "No pages could be extracted successfully."
    elif sections_saved == 0:
        job.status = "failed"
        job.error_code = "no_extractable_content"
        job.error_message = "Pages were crawled, but no usable content sections were found."
    else:
        job.status = "completed"
        job.error_code = None
        job.error_message = None

    db.commit()
    db.refresh(job)
    return successful_pages, sections_saved
