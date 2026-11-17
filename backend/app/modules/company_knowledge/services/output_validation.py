import hashlib
from urllib.parse import urlsplit

from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
    ExtractedPage,
)
from app.modules.company_knowledge.services.website_validation import (
    WebsiteValidationError,
    canonicalize_url,
    is_same_site,
)


def validate_and_deduplicate(
    payload: CrawlPipelineOutput,
    *,
    allowed_host: str,
) -> CrawlPipelineOutput:
    validated = CrawlPipelineOutput.model_validate(payload.model_dump())
    unique_pages: dict[str, ExtractedPage] = {}

    for page in validated.pages:
        page_url = canonicalize_url(page.page_url)
        if not is_same_site(
            allowed_host,
            urlsplit(page_url).hostname or "",
        ):
            continue

        page.page_url = page_url
        unique_sections = []
        seen_sections: set[str] = set()
        for section in page.sections:
            source_url = canonicalize_url(section.source_url)
            if source_url != page_url:
                continue
            section.source_url = source_url
            digest = hashlib.sha256(
                "\0".join(
                    (
                        section.category.casefold(),
                        section.heading_path.casefold(),
                        section.title.casefold(),
                        section.content.casefold(),
                    )
                ).encode("utf-8")
            ).hexdigest()
            if digest not in seen_sections:
                seen_sections.add(digest)
                unique_sections.append(section)
        page.sections = unique_sections

        existing = unique_pages.get(page_url)
        if existing is None or (
            existing.crawl_status != "success"
            and page.crawl_status == "success"
        ):
            unique_pages[page_url] = page

    if not unique_pages:
        raise WebsiteValidationError(
            "no_eligible_pages",
            "The crawler did not find any eligible pages on the website.",
            422,
        )

    return CrawlPipelineOutput(pages=list(unique_pages.values()))
