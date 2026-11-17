import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from http import HTTPStatus
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser
from xml.etree import ElementTree

import httpx

from app.core.config import settings


USER_AGENT = "NexoraAI-Bot"
MAX_REDIRECTS = 5
MAX_SITEMAP_BYTES = 2 * 1024 * 1024
MAX_SITEMAP_URLS = 500


class WebsiteValidationError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class FetchedResponse:
    status_code: int
    url: str
    headers: httpx.Headers
    body: bytes


@dataclass(frozen=True)
class ValidatedWebsite:
    website_url: str
    host: str
    sitemap_available: bool
    sitemap_urls: list[str]
    robots_text: str


def canonicalize_url(url: str) -> str:
    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        raise WebsiteValidationError(
            "invalid_url",
            "The website URL is malformed.",
        ) from exc
    scheme = parts.scheme.lower()
    hostname = (parts.hostname or "").lower().rstrip(".")

    if scheme not in {"http", "https"} or not hostname:
        raise WebsiteValidationError(
            "invalid_url",
            "Use a public HTTP or HTTPS website URL.",
        )
    if parts.username is not None or parts.password is not None:
        raise WebsiteValidationError(
            "invalid_url",
            "Website URLs cannot include username or password information.",
        )
    try:
        port = parts.port
    except ValueError as exc:
        raise WebsiteValidationError(
            "invalid_url",
            "The website URL contains an invalid port.",
        ) from exc
    if port not in (None, 80 if scheme == "http" else 443):
        raise WebsiteValidationError(
            "invalid_url",
            "Website URLs may use only the standard HTTP or HTTPS port.",
        )

    netloc = f"[{hostname}]" if ":" in hostname else hostname
    path = parts.path or "/"
    return urlunsplit((scheme, netloc, path, parts.query, ""))


def is_same_site(host: str, candidate_host: str) -> bool:
    host = host.lower().removeprefix("www.")
    candidate_host = candidate_host.lower().removeprefix("www.")
    return host == candidate_host


async def ensure_public_url(url: str) -> str:
    canonical = canonicalize_url(url)
    parts = urlsplit(canonical)
    port = 443 if parts.scheme == "https" else 80

    try:
        records = await asyncio.get_running_loop().getaddrinfo(
            parts.hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except (OSError, socket.gaierror) as exc:
        raise WebsiteValidationError(
            "website_unavailable",
            "The website host could not be resolved.",
            502,
        ) from exc

    addresses = {record[4][0] for record in records}
    if not addresses:
        raise WebsiteValidationError(
            "website_unavailable",
            "The website host did not resolve to an address.",
            502,
        )

    for address in addresses:
        parsed_address = ipaddress.ip_address(address.split("%", 1)[0])
        if not parsed_address.is_global:
            raise WebsiteValidationError(
                "unsafe_destination",
                "The website resolves to a non-public network address.",
                403,
            )

    return canonical


async def _read_limited(response: httpx.Response, max_bytes: int) -> bytes:
    data = bytearray()
    async for chunk in response.aiter_bytes():
        if len(data) + len(chunk) > max_bytes:
            raise WebsiteValidationError(
                "response_too_large",
                "A website validation response exceeded the size limit.",
                413,
            )
        data.extend(chunk)
    return bytes(data)


async def fetch_public_url(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_bytes: int = 0,
    allowed_host: str | None = None,
) -> FetchedResponse:
    current_url = canonicalize_url(url)
    original_host = allowed_host or urlsplit(current_url).hostname or ""

    for redirect_number in range(MAX_REDIRECTS + 1):
        current_url = await ensure_public_url(current_url)
        current_host = urlsplit(current_url).hostname or ""
        if not is_same_site(original_host, current_host):
            raise WebsiteValidationError(
                "cross_site_redirect",
                "The website redirected outside its original site.",
                403,
            )

        try:
            async with client.stream("GET", current_url) as response:
                if response.status_code in {
                    HTTPStatus.MOVED_PERMANENTLY,
                    HTTPStatus.FOUND,
                    HTTPStatus.SEE_OTHER,
                    HTTPStatus.TEMPORARY_REDIRECT,
                    HTTPStatus.PERMANENT_REDIRECT,
                }:
                    location = response.headers.get("location")
                    if not location or redirect_number == MAX_REDIRECTS:
                        raise WebsiteValidationError(
                            "too_many_redirects",
                            "The website returned an invalid or excessive redirect chain.",
                            502,
                        )
                    current_url = urljoin(current_url, location)
                    continue

                body = await _read_limited(response, max_bytes) if max_bytes else b""
                return FetchedResponse(
                    status_code=response.status_code,
                    url=str(response.url),
                    headers=response.headers,
                    body=body,
                )
        except WebsiteValidationError:
            raise
        except httpx.TimeoutException as exc:
            raise WebsiteValidationError(
                "website_timeout",
                "The website did not respond before the validation timeout.",
                504,
            ) from exc
        except httpx.HTTPError as exc:
            raise WebsiteValidationError(
                "website_unavailable",
                "The website could not be reached.",
                502,
            ) from exc

    raise WebsiteValidationError(
        "too_many_redirects",
        "The website returned an excessive redirect chain.",
        502,
    )


def _parse_sitemap(
    body: bytes,
    host: str,
) -> tuple[list[str], list[str]]:
    if b"<!DOCTYPE" in body.upper():
        return [], []

    try:
        root = ElementTree.fromstring(body)
    except ElementTree.ParseError:
        return [], []

    root_type = root.tag.rsplit("}", 1)[-1]
    page_urls: list[str] = []
    sitemap_urls: list[str] = []
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] != "loc" or not element.text:
            continue
        try:
            url = canonicalize_url(element.text)
        except WebsiteValidationError:
            continue
        candidate_host = urlsplit(url).hostname or ""
        if not is_same_site(host, candidate_host):
            continue
        target = sitemap_urls if root_type == "sitemapindex" else page_urls
        if url not in target:
            target.append(url)
        if len(page_urls) + len(sitemap_urls) >= MAX_SITEMAP_URLS:
            break
    return page_urls, sitemap_urls


async def validate_website(website_url: str) -> ValidatedWebsite:
    canonical_url = await ensure_public_url(website_url)
    requested_host = urlsplit(canonical_url).hostname or ""
    timeout = httpx.Timeout(settings.CRAWL_HTTP_TIMEOUT_SECONDS)

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        trust_env=False,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        homepage = await fetch_public_url(
            client,
            canonical_url,
            allowed_host=requested_host,
        )

        if homepage.status_code in (401, 403):
            raise WebsiteValidationError(
                "website_forbidden",
                "The website forbids access to its homepage.",
                403,
            )
        if homepage.status_code < 200 or homepage.status_code >= 300:
            raise WebsiteValidationError(
                "website_unavailable",
                f"The website returned HTTP {homepage.status_code}.",
                502 if homepage.status_code >= 500 else 422,
            )

        content_type = homepage.headers.get("content-type", "").lower()
        if content_type and "text/html" not in content_type:
            raise WebsiteValidationError(
                "not_html",
                "The supplied URL does not return an HTML page.",
            )

        final_url = canonicalize_url(homepage.url)
        site_host = urlsplit(final_url).hostname or requested_host
        robots_url = urljoin(final_url, "/robots.txt")
        robots_response = await fetch_public_url(
            client,
            robots_url,
            max_bytes=MAX_SITEMAP_BYTES,
            allowed_host=site_host,
        )

        if robots_response.status_code in (401, 403):
            raise WebsiteValidationError(
                "robots_unavailable",
                "The site's robots.txt rules cannot be read, so crawling is not permitted.",
                403,
            )
        if robots_response.status_code >= 500:
            raise WebsiteValidationError(
                "robots_unavailable",
                "The site's robots.txt could not be checked.",
                502,
            )

        robots_text = (
            robots_response.body.decode("utf-8", errors="replace")
            if robots_response.status_code == 200
            else ""
        )
        parser = RobotFileParser()
        parser.set_url(robots_url)
        parser.parse(robots_text.splitlines())

        sitemap_locations = [
            line.split(":", 1)[1].strip()
            for line in robots_text.splitlines()
            if line.lower().startswith("sitemap:") and ":" in line
        ]
        if not sitemap_locations:
            sitemap_locations = [urljoin(final_url, "/sitemap.xml")]

        sitemap_urls: list[str] = []
        sitemap_available = False
        sitemap_queue = sitemap_locations[:5]
        fetched_sitemaps: set[str] = set()
        while sitemap_queue and len(fetched_sitemaps) < 5:
            sitemap_url = sitemap_queue.pop(0)
            try:
                sitemap_url = canonicalize_url(sitemap_url)
                if not is_same_site(
                    site_host,
                    urlsplit(sitemap_url).hostname or "",
                ):
                    continue
                if sitemap_url in fetched_sitemaps:
                    continue
                fetched_sitemaps.add(sitemap_url)
                sitemap_response = await fetch_public_url(
                    client,
                    sitemap_url,
                    max_bytes=MAX_SITEMAP_BYTES,
                    allowed_host=site_host,
                )
            except WebsiteValidationError:
                continue

            if sitemap_response.status_code == 200:
                sitemap_available = True
                page_urls, child_sitemaps = _parse_sitemap(
                    sitemap_response.body,
                    site_host,
                )
                sitemap_queue.extend(
                    child
                    for child in child_sitemaps
                    if child not in fetched_sitemaps
                )
                for page_url in page_urls:
                    if parser.can_fetch(USER_AGENT, page_url) and page_url not in sitemap_urls:
                        sitemap_urls.append(page_url)
                    if len(sitemap_urls) >= MAX_SITEMAP_URLS:
                        break

        eligible_seeds = [
            page_url
            for page_url in [final_url, *sitemap_urls]
            if parser.can_fetch(USER_AGENT, page_url)
        ]
        if not eligible_seeds:
            raise WebsiteValidationError(
                "no_eligible_pages",
                "Robots rules disallow the homepage and no permitted sitemap pages were found.",
                403,
            )

        return ValidatedWebsite(
            website_url=final_url,
            host=site_host,
            sitemap_available=sitemap_available,
            sitemap_urls=sitemap_urls,
            robots_text=robots_text,
        )
