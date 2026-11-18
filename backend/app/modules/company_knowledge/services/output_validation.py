"""Validate page ownership, verify marketing evidence, and generate quality metrics."""

from collections import defaultdict
import hashlib
import re
from urllib.parse import urlsplit

from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
    CrawlQualityReport,
    ExtractedPage,
    ExtractedSection,
)
from app.modules.company_knowledge.services.website_validation import (
    WebsiteValidationError,
    canonicalize_url,
    is_same_site,
)


def _normalize_content(content: str) -> str:
    return re.sub(r"\s+", " ", content.strip().casefold())


def validate_and_deduplicate(
    payload: CrawlPipelineOutput,
    *,
    allowed_host: str,
) -> CrawlPipelineOutput:
    """
    Validate crawl output, enforce host isolation, verify evidence,
    suppress cross-page duplicate boilerplate, and compute CrawlQualityReport.
    """
    validated = CrawlPipelineOutput.model_validate(
        payload.model_dump()
    )

    pages_crawled = len(validated.pages)
    business_candidates_extracted = sum(len(p.sections) for p in validated.pages)

    marketing_relevant_candidates = 0
    marketing_irrelevant_candidates = 0
    pending_review_candidates = 0
    verified_candidates = 0
    rejected_candidates = 0
    duplicate_candidates = 0
    boilerplate_blocks_removed = 0
    source_verification_failures = 0
    classification_conflicts = 0

    unique_pages: dict[str, ExtractedPage] = {}
    content_page_counts: dict[str, set[str]] = defaultdict(set)

    for page in validated.pages:
        try:
            page_url = canonicalize_url(page.page_url)
        except WebsiteValidationError:
            continue

        if not is_same_site(
            allowed_host,
            urlsplit(page_url).hostname or "",
        ):
            continue

        for section in page.sections:
            norm = _normalize_content(section.content)
            digest = hashlib.sha256(norm.encode("utf-8")).hexdigest()
            content_page_counts[digest].add(page_url)

    # Threshold for considering content cross-page boilerplate (appears on >= 25% of pages and >= 3 pages)
    min_pages_threshold = max(3, int(pages_crawled * 0.25)) if pages_crawled > 5 else 3
    seen_cross_page_hashes: set[str] = set()

    for page in validated.pages:
        try:
            page_url = canonicalize_url(page.page_url)
        except WebsiteValidationError:
            continue

        if not is_same_site(
            allowed_host,
            urlsplit(page_url).hostname or "",
        ):
            continue

        page.page_url = page_url
        validated_sections: list[ExtractedSection] = []
        seen_in_page: set[str] = set()

        for section in page.sections:
            try:
                source_url = canonicalize_url(section.source_url)
            except WebsiteValidationError:
                source_verification_failures += 1
                continue

            if source_url != page_url:
                source_verification_failures += 1
                continue

            section.source_url = source_url

            # Intra-page exact deduplication
            intra_digest = hashlib.sha256(
                "\0".join(
                    (
                        section.heading_path.casefold(),
                        section.title.casefold(),
                        section.content.casefold(),
                    )
                ).encode("utf-8")
            ).hexdigest()

            if intra_digest in seen_in_page:
                duplicate_candidates += 1
                rejected_candidates += 1
                continue

            seen_in_page.add(intra_digest)

            # Check cross-page repetition
            norm = _normalize_content(section.content)
            norm_digest = hashlib.sha256(norm.encode("utf-8")).hexdigest()
            pages_with_content = content_page_counts.get(norm_digest, set())

            is_boilerplate = bool(section.metadata.get("is_boilerplate", False))
            relevance = section.metadata.get("marketing_relevance", "relevant")
            confidence = float(section.metadata.get("confidence", 0.7))
            entity_type = section.metadata.get("entity_type", "")

            # Genuine company taglines, service descriptions, differentiators,
            # and customer evidence must NOT be suppressed across pages solely
            # because they appear on multiple pages; preserve valid source relationships.
            is_marketing_fact = (
                relevance == "relevant"
                and (
                    entity_type in (
                        "company_identity",
                        "proof_case_study",
                        "offering_service",
                        "offering_product",
                        "offering_solution",
                        "partnership_tech",
                        "employer_brand",
                        "industry_target",
                    )
                    or section.category in (
                        "Brand Identities",
                        "Case Studies",
                        "Customers",
                        "Solutions",
                        "Services",
                        "Products",
                        "Achievements",
                        "Innovations and Research",
                    )
                )
            )

            if not is_marketing_fact and len(pages_with_content) >= min_pages_threshold:
                if norm_digest in seen_cross_page_hashes:
                    # Suppress duplicate occurrence of non-marketing boilerplate
                    duplicate_candidates += 1
                    rejected_candidates += 1
                    section.metadata["is_duplicate"] = True
                    section.metadata["is_boilerplate"] = True
                    section.metadata["rejection_reason"] = "cross_page_repetition"
                    continue
                else:
                    seen_cross_page_hashes.add(norm_digest)

            if is_boilerplate or relevance == "irrelevant":
                boilerplate_blocks_removed += 1
                marketing_irrelevant_candidates += 1
                rejected_candidates += 1
                section.metadata["is_boilerplate"] = True
                section.metadata["verification_status"] = "rejected"
            else:
                # Marketing candidate passed extraction & relevance evaluation.
                # In automated website crawling, source-grounded human/admin verification
                # is incomplete, so candidates are staged as pending_review rather than verified.
                is_source_verified = bool(section.metadata.get("is_source_verified", False))

                marketing_relevant_candidates += 1
                if confidence < 0.40:
                    classification_conflicts += 1

                if is_source_verified:
                    verified_candidates += 1
                    section.metadata["verification_status"] = "verified"
                else:
                    pending_review_candidates += 1
                    section.metadata["verification_status"] = "pending_review"

            validated_sections.append(section)

        page.sections = validated_sections

        existing = unique_pages.get(page_url)
        if existing is None or (
            existing.crawl_status != "success"
            and page.crawl_status == "success"
        ):
            unique_pages[page_url] = page

    if not unique_pages:
        raise WebsiteValidationError(
            "no_eligible_pages",
            "No eligible pages found.",
            422,
        )

    pages_list = list(unique_pages.values())
    trusted_records_persisted = verified_candidates
    rag_indexed_records = verified_candidates
    staged_records_persisted = verified_candidates + pending_review_candidates

    quality_report = CrawlQualityReport(
        pages_crawled=pages_crawled,
        business_candidates_extracted=business_candidates_extracted,
        marketing_relevant_candidates=marketing_relevant_candidates,
        marketing_irrelevant_candidates=marketing_irrelevant_candidates,
        pending_review_candidates=pending_review_candidates,
        verified_candidates=verified_candidates,
        rejected_candidates=rejected_candidates,
        duplicate_candidates=duplicate_candidates,
        boilerplate_blocks_removed=boilerplate_blocks_removed,
        source_verification_failures=source_verification_failures,
        classification_conflicts=classification_conflicts,
        trusted_records_persisted=trusted_records_persisted,
        rag_indexed_records=rag_indexed_records,
        staged_records_persisted=staged_records_persisted,
    )

    return CrawlPipelineOutput(
        pages=pages_list,
        quality_report=quality_report,
    )
