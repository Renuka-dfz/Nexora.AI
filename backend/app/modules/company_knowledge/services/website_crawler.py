import asyncio
import hashlib
import logging
from collections import deque
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from app.core.config import settings
from app.modules.company_knowledge.services.content_cleaning import (
    clean_and_split_page,
)
from app.modules.company_knowledge.services.pipeline_schemas import (
    CrawlPipelineOutput,
    ExtractedPage,
)
from app.modules.company_knowledge.services.website_validation import (
    USER_AGENT,
    ValidatedWebsite,
    WebsiteValidationError,
    canonicalize_url,
    fetch_public_url,
    is_same_site,
)


logger = logging.getLogger(__name__)
MAX_LINK_CANDIDATES = 1000
MAX_STORED_HTML_CHARS = 2_000_000
MAX_STORED_MARKDOWN_CHARS = 500_000


def _plain_metadata(value: object) -> object:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {
            str(key): _plain_metadata(item)
            for key, item in list(value.items())[:100]
            if isinstance(key, (str, int, float, bool))
        }
    if isinstance(value, (list, tuple)):
        return [_plain_metadata(item) for item in value[:100]]
    return str(value)[:1000]


def _get_meta_description(html: str) -> str | None:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "html.parser")
    meta = soup.find("meta", attrs={"name": "description"})
    if meta is None:
        meta = soup.find("meta", attrs={"property": "og:description"})
    content = meta.get("content") if meta else None
    return " ".join(content.split())[:4000] if content else None


def _links_from_result(result: object, page_url: str, host: str) -> list[str]:
    links = getattr(result, "links", None) or {}
    internal_links = links.get("internal", []) if isinstance(links, dict) else []
    candidates: list[str] = []

    for link in internal_links:
        if not isinstance(link, dict):
            continue
        href = link.get("href") or link.get("url")
        if not isinstance(href, str):
            continue
        try:
            candidate = canonicalize_url(urljoin(page_url, href))
        except WebsiteValidationError:
            continue
        if not is_same_site(host, urlsplit(candidate).hostname or ""):
            continue
        if candidate not in candidates:
            candidates.append(candidate)
        if len(candidates) >= MAX_LINK_CANDIDATES:
            break
    return candidates


def _result_markdown(result: object) -> str:
    markdown = getattr(result, "markdown", None)
    if markdown is None:
        return ""
    if isinstance(markdown, str):
        return markdown
    raw_markdown = getattr(markdown, "raw_markdown", None)
    return raw_markdown if isinstance(raw_markdown, str) else str(markdown)


async def discover_and_extract(
    website: ValidatedWebsite,
) -> CrawlPipelineOutput:
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

    robots = RobotFileParser()
    robots.set_url(urljoin(website.website_url, "/robots.txt"))
    robots.parse(website.robots_text.splitlines())

    seeds = [website.website_url, *website.sitemap_urls]
    queue: deque[tuple[str, int]] = deque()
    seen: set[str] = set()
    for seed in seeds:
        try:
            canonical = canonicalize_url(seed)
        except WebsiteValidationError:
            continue
        if canonical not in seen:
            seen.add(canonical)
            queue.append((canonical, 0))

    pages: list[ExtractedPage] = []
    run_config = CrawlerRunConfig(
        page_timeout=settings.CRAWL_PAGE_TIMEOUT_MS,
        check_robots_txt=True,
        user_agent=USER_AGENT,
        excluded_tags=["script", "style", "noscript", "svg", "nav", "footer"],
        exclude_external_links=True,
        verbose=False,
    )

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(settings.CRAWL_HTTP_TIMEOUT_SECONDS),
        follow_redirects=False,
        trust_env=False,
        headers={"User-Agent": USER_AGENT},
    ) as validation_client:
        async with AsyncWebCrawler() as crawler:
            while queue and len(pages) < settings.CRAWL_MAX_PAGES:
                page_url, depth = queue.popleft()
                page_host = urlsplit(page_url).hostname or ""
                if not is_same_site(website.host, page_host):
                    continue
                if not robots.can_fetch(USER_AGENT, page_url):
                    continue

                try:
                    preflight = await fetch_public_url(
                        validation_client,
                        page_url,
                        allowed_host=website.host,
                    )
                except WebsiteValidationError as exc:
                    logger.warning(
                        "Skipping an unavailable or unsafe crawl target",
                        extra={"url": page_url, "error_code": exc.code},
                    )
                    pages.append(
                        ExtractedPage(
                            page_url=page_url,
                            crawl_status="skipped",
                            error_message=exc.message,
                            metadata={"depth": depth},
                        )
                    )
                    continue

                if preflight.status_code < 200 or preflight.status_code >= 300:
                    pages.append(
                        ExtractedPage(
                            page_url=page_url,
                            crawl_status="failed",
                            error_message=f"HTTP {preflight.status_code}",
                            metadata={
                                "depth": depth,
                                "status_code": preflight.status_code,
                            },
                        )
                    )
                    continue
                content_type = preflight.headers.get("content-type", "").lower()
                if content_type and "text/html" not in content_type:
                    pages.append(
                        ExtractedPage(
                            page_url=page_url,
                            crawl_status="skipped",
                            error_message="The URL does not return an HTML page.",
                            metadata={
                                "depth": depth,
                                "content_type": content_type[:255],
                            },
                        )
                    )
                    continue
                if not is_same_site(
                    website.host,
                    urlsplit(preflight.url).hostname or "",
                ):
                    continue
                page_url = canonicalize_url(preflight.url)

                try:
                    result = await crawler.arun(page_url, config=run_config)
                except Exception as exc:
                    logger.exception(
                        "Crawl4AI failed to crawl a page",
                        extra={"url": page_url},
                    )
                    pages.append(
                        ExtractedPage(
                            page_url=page_url,
                            crawl_status="failed",
                            error_message=str(exc)[:2000],
                            metadata={"depth": depth},
                        )
                    )
                    continue

                result_url = (
                    getattr(result, "redirected_url", None)
                    or getattr(result, "url", None)
                    or page_url
                )
                try:
                    result_url = canonicalize_url(result_url)
                except WebsiteValidationError:
                    result_url = page_url
                result_host = urlsplit(result_url).hostname or ""
                if not is_same_site(website.host, result_host):
                    pages.append(
                        ExtractedPage(
                            page_url=page_url,
                            crawl_status="skipped",
                            error_message="Page redirected outside the allowed website.",
                            metadata={"depth": depth},
                        )
                    )
                    continue

                for discovered_url in _links_from_result(result, result_url, website.host):
                    if (
                        discovered_url not in seen
                        and depth < settings.CRAWL_MAX_DEPTH
                        and len(seen) < MAX_LINK_CANDIDATES
                        and robots.can_fetch(USER_AGENT, discovered_url)
                    ):
                        seen.add(discovered_url)
                        queue.append((discovered_url, depth + 1))

                status_code = getattr(result, "status_code", None)
                if not getattr(result, "success", False) or (
                    status_code is not None and status_code >= 400
                ):
                    pages.append(
                        ExtractedPage(
                            page_url=page_url,
                            crawl_status="failed",
                            error_message=(
                                getattr(result, "error_message", None)
                                or f"Crawl returned HTTP {status_code}."
                            )[:2000],
                            metadata={
                                "depth": depth,
                                "status_code": status_code,
                            },
                        )
                    )
                    continue

                raw_html = getattr(result, "html", None) or ""
                cleaned_html = getattr(result, "cleaned_html", None) or raw_html
                markdown = _result_markdown(result)
                metadata = _plain_metadata(
                    getattr(result, "metadata", None) or {}
                )
                if not isinstance(metadata, dict):
                    metadata = {}
                metadata.update(
                    {
                        "depth": depth,
                        "status_code": status_code,
                    }
                )

                title = metadata.get("title")
                if not isinstance(title, str) or not title.strip():
                    from bs4 import BeautifulSoup

                    soup = BeautifulSoup(cleaned_html, "html.parser")
                    title_element = soup.find("title")
                    title = (
                        title_element.get_text(" ", strip=True)
                        if title_element
                        else None
                    )

                meta_description = _get_meta_description(cleaned_html)
                sections = clean_and_split_page(
                    html=cleaned_html,
                    page_url=result_url,
                    page_title=title,
                    meta_description=meta_description,
                )
                content_hash = hashlib.sha256(
                    (markdown or cleaned_html).encode("utf-8", errors="replace")
                ).hexdigest()
                metadata["content_hash"] = content_hash

                pages.append(
                    ExtractedPage(
                        page_url=result_url,
                        title=title[:500] if title else None,
                        meta_description=meta_description,
                        raw_html=raw_html[:MAX_STORED_HTML_CHARS],
                        markdown_content=markdown[:MAX_STORED_MARKDOWN_CHARS],
                        metadata=metadata,
                        crawl_status="success",
                        sections=sections,
                    )
                )

    return CrawlPipelineOutput(pages=pages)
