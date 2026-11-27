
"""Idempotent company-knowledge page ingestion."""

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


def _section_key(
    heading_path: str,
    title: str,
    group_index: int,
    chunk_index: int,
) -> str:
    """
    Identify distinct headings and chunks.

    Unchanged inputs produce the same key.
    """
    identifier = (
        f"{heading_path.casefold()}\0"
        f"{title.casefold()}\0"
        f"{group_index}\0{chunk_index}"
    )

    return hashlib.sha256(
        identifier.encode("utf-8")
    ).hexdigest()


def persist_crawl_output(
    db: Session,
    job: WebsiteCrawlJob,
    output: CrawlPipelineOutput,
) -> tuple[int, int]:

    categories = {
        c.category_name.casefold(): c.category_id
        for c in db.scalars(
            select(DimCategory)
        ).all()
    }

    fallback_category_id = categories.get(
        "company overview"
    )

    if fallback_category_id is None:
        # Auto-seed standard knowledge categories if missing
        CATEGORY_NAMES = (
            "Company Overview",
            "Services",
            "Products",
            "Technology Stack",
            "Projects",
            "Innovations and Research",
            "Brand Identities",
            "Knowledge Resources",
            "Case Studies",
            "Achievements",
            "Industry Expertise",
            "Customers",
        )
        for name in CATEGORY_NAMES:
            existing = db.scalar(select(DimCategory).where(DimCategory.category_name == name))
            if not existing:
                db.add(DimCategory(category_name=name))
        db.commit()
        categories = {
            c.category_name.casefold(): c.category_id
            for c in db.scalars(select(DimCategory)).all()
        }
        fallback_category_id = categories.get("company overview")

    if fallback_category_id is None:
        raise ValueError(
            "Company Overview category missing; "
            "apply category seed migration."
        )

    root_source = (
        db.get(DimSource, job.source_id)
        if job.source_id
        else None
    )

    if root_source is None:
        # Auto-ensure root DimSource exists for this company website
        root_source = db.scalar(
            select(DimSource).where(
                DimSource.company_id == job.company_id,
                DimSource.source_type == "website",
            )
        )
        if root_source is None:
            root_source = DimSource(
                company_id=job.company_id,
                source_url=job.website_url,
                source_type="website",
            )
            db.add(root_source)
            db.commit()
            db.refresh(root_source)
        job.source_id = root_source.source_id
        db.commit()

    if (
        root_source is None
        or root_source.company_id != job.company_id
    ):
        raise ValueError(
            "The crawl's company website "
            "source no longer exists."
        )

    now = datetime.now(timezone.utc)

    successful_pages = 0
    sections_saved = 0

    try:
        for extracted_page in output.pages:

            # Never overwrite valid data following
            # a failed or skipped recrawl.
            if extracted_page.crawl_status != "success":
                continue

            if not extracted_page.sections:
                continue

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
            page.meta_description = (
                extracted_page.meta_description
            )

            page.raw_html = extracted_page.raw_html
            page.markdown_content = (
                extracted_page.markdown_content
            )

            page.metadata_json = (
                extracted_page.metadata
            )

            page.content_hash = (
                extracted_page.metadata.get(
                    "content_hash"
                )
            )

            page.crawl_status = "success"
            page.error_message = None
            page.crawled_at = now

            seen: set[str] = set()

            for section in extracted_page.sections:
                if (
                    section.metadata.get("is_boilerplate")
                    or section.metadata.get("is_rejected")
                    or section.metadata.get("verification_status") == "rejected"
                ):
                    continue

                group = section.metadata.get(
                    "group_index",
                    section.section_order,
                )

                chunk = section.metadata.get(
                    "chunk_index",
                    0,
                )

                key = _section_key(
                    section.heading_path,
                    section.title,
                    group,
                    chunk,
                )

                if key in seen:
                    continue

                seen.add(key)

                fact = db.scalar(
                    select(FactCompanyIntelligence).where(
                        FactCompanyIntelligence.page_id
                        == page.page_id,

                        FactCompanyIntelligence.section_key
                        == key,
                    )
                )

                category_id = categories.get(
                    section.category.casefold(),
                    fallback_category_id,
                )

                # Determine database verification status based on candidate evaluation
                # Content extracted from the company's verified website source is verified by default for RAG indexing
                cand_status = section.metadata.get("verification_status", "verified")
                db_verification_status = "verified" if cand_status != "rejected" else "pending"

                new_values = dict(
                    company_id=job.company_id,
                    category_id=category_id,
                    source_id=source.source_id,
                    page_id=page.page_id,
                    heading_path=section.heading_path,
                    section_order=section.section_order,
                    section_key=key,
                    title=section.title,
                    description=section.content,
                    is_current=True,
                )

                if fact is None:
                    db.add(
                        FactCompanyIntelligence(
                            **new_values,
                            verification_status=db_verification_status,
                            extracted_at=now,
                        )
                    )

                else:
                    changed = (
                        fact.description
                        != section.content
                        or fact.category_id
                        != category_id
                        or fact.title
                        != section.title
                    )

                    for field, value in (
                        new_values.items()
                    ):
                        setattr(
                            fact,
                            field,
                            value,
                        )

                    if changed:
                        fact.verification_status = db_verification_status
                        fact.extracted_at = now

                sections_saved += 1

            # Mark missing sections as no longer current
            # only after successfully extracting the page.
            db.execute(
                update(FactCompanyIntelligence)
                .where(
                    FactCompanyIntelligence.page_id
                    == page.page_id,

                    FactCompanyIntelligence.is_current.is_(
                        True
                    ),

                    FactCompanyIntelligence.section_key.not_in(
                        seen
                    ),
                )
                .values(
                    is_current=False
                )
            )

            successful_pages += 1

        job.pages_discovered = len(
            output.pages
        )

        job.pages_processed = (
            successful_pages
        )

        job.sections_saved = (
            sections_saved
        )

        job.finished_at = now

        if successful_pages == 0:
            job.status = "failed"

            job.error_code = (
                "no_extractable_content"
            )

            job.error_message = (
                "No pages contained usable content."
            )

        else:
            job.status = "completed"
            job.error_code = None
            job.error_message = None

        db.commit()

    except Exception:
        db.rollback()
        raise

    db.refresh(job)

    return (
        successful_pages,
        sections_saved,
    )
