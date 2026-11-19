"""Extract headings and content without dropping long sections.

Preserves heading-to-content alignment, structures table rows, handles FAQ summaries,
evaluates marketing relevance, and maps business entities.
"""

import hashlib
import re
import unicodedata
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from app.modules.company_knowledge.services.classification import (
    classify_section_details,
)
from app.modules.company_knowledge.services.marketing_relevance import (
    evaluate_marketing_relevance,
)
from app.modules.company_knowledge.services.page_understanding import (
    detect_page_type,
)
from app.modules.company_knowledge.services.pipeline_schemas import (
    ExtractedSection,
)

MAX_SECTION_CHARS = 3000

REMOVED_TAGS = (
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "footer",
    "form",
    "aside",
    "menu",
)

NOISE_PATTERNS = frozenset(
    {
        "read more",
        "learn more",
        "see more",
        "click here",
        "get started",
        "view details",
        "learn more →",
        "read more →",
        "see this step →",
        "accept",
        "decline",
        "accept all",
        "reject all",
        "agree",
        "close",
        "menu",
    }
)


def _clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)

    value = "".join(
        ch
        for ch in value
        if ch in "\n\t"
        or unicodedata.category(ch)[0] != "C"
    )

    return re.sub(r"\s+", " ", value).strip()


def _split_text(value: str) -> list[str]:
    """
    Split normalized text into bounded chunks.

    All normalized words are preserved.
    """
    if not value:
        return []

    words = value.split(" ")

    chunks: list[str] = []
    current = ""

    for word in words:
        while len(word) > MAX_SECTION_CHARS:
            if current:
                chunks.append(current)
                current = ""

            chunks.append(word[:MAX_SECTION_CHARS])
            word = word[MAX_SECTION_CHARS:]

        if not word:
            continue

        if (
            len(current)
            + len(word)
            + bool(current)
            > MAX_SECTION_CHARS
        ):
            chunks.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()

    if current:
        chunks.append(current)

    return chunks


def clean_and_split_page(
    *,
    html: str,
    page_url: str,
    page_title: str | None,
    meta_description: str | None,
) -> list[ExtractedSection]:

    soup = BeautifulSoup(
        html or "",
        "html.parser",
    )

    # Remove non-content tags
    for node in soup.find_all(REMOVED_TAGS):
        node.decompose()

    # Decompose top-level/site-wide headers containing navigation or menus
    for header in soup.find_all("header"):
        if (
            header.find(["nav", "ul", "ol", "menu"])
            or header.get("role") in ("banner", "navigation")
            or "head" in " ".join(header.get("class", [])).lower()
        ):
            header.decompose()

    # Decompose cookie/consent banners, dialogs, overlays, search modals, and sharing controls
    for node in soup.select(
        '[aria-hidden="true"], [role="navigation"], [role="banner"], [role="search"], '
        '[role="dialog"], [role="alertdialog"], [aria-modal="true"], '
        'div.consent, [class*="cookie" i], [class*="consent" i], [id*="cookie" i], [id*="consent" i], '
        '[class*="onetrust" i], .cookiebot, .cc-window, .gdpr, '
        '[class*="share-button" i], [class*="social-share" i]'
    ):
        node.decompose()

    title = _clean_text(page_title or "")

    if not title and soup.title:
        title = _clean_text(
            soup.title.get_text(" ", strip=True)
        )

    title = (
        title
        or urlsplit(page_url)
        .path.strip("/")
        .replace("-", " ")
        .title()
        or "Website overview"
    )

    # Collect primary H1/H2 headings for page understanding
    primary_headings = [
        _clean_text(h.get_text(" ", strip=True))
        for h in soup.find_all(["h1", "h2"])
        if _clean_text(h.get_text(" ", strip=True))
    ][:5]

    page_type = detect_page_type(
        page_url=page_url,
        title=title,
        meta_description=meta_description,
        main_headings=primary_headings,
    )

    groups: list[tuple[str, str, str]] = []
    headings: list[tuple[int, str]] = []
    current_heading = title
    current_path = title
    parts: list[str] = []

    def finish_group() -> None:
        normalized = _clean_text(" ".join(parts))
        if normalized and len(normalized) >= 15:
            groups.append(
                (
                    current_heading,
                    current_path,
                    normalized,
                )
            )

    body = soup.body or soup

    # Extract useful headings, paragraphs, FAQ items, and table rows.
    for element in body.find_all(
        [
            "h1", "h2", "h3",
            "h4", "h5", "h6",
            "summary", "p", "li", "blockquote",
            "dt", "dd", "tr",
        ]
    ):
        # Do not extract container elements as single blocks if they have child headings or paragraphs.
        # This prevents child card descriptions from leaking into previous card headings.
        if element.name in {"li", "blockquote", "dt", "dd"}:
            if element.find(
                [
                    "h1", "h2", "h3", "h4", "h5", "h6",
                    "summary", "p", "li", "blockquote",
                    "tr", "table", "div",
                ]
            ):
                continue

        # Skip elements inside tables since table rows are processed atomically
        if (
            element.name in {"li", "p", "dt", "dd"}
            and element.find_parent("tr")
        ):
            continue

        if element.name == "tr":
            cells = element.find_all(["th", "td"])
            cell_texts = [
                _clean_text(cell.get_text(" ", strip=True))
                for cell in cells
                if _clean_text(cell.get_text(" ", strip=True))
            ]
            if cell_texts:
                parts.append(" | ".join(cell_texts))
            continue

        text = _clean_text(
            element.get_text(" ", strip=True)
        )

        if not text:
            continue

        # Filter out trivial button noise and standalone punctuation
        if text.casefold() in NOISE_PATTERNS or len(text) <= 2:
            continue

        if re.fullmatch(r"h[1-6]", element.name or "") or element.name == "summary":
            finish_group()

            level = (
                int(element.name[1])
                if element.name.startswith("h")
                else 3
            )

            headings = [
                (n, value)
                for n, value in headings
                if n < level
            ]

            headings.append((level, text))

            current_path = " > ".join(
                value
                for _, value in headings
            )

            current_heading = text[:255]
            parts = []

        else:
            parts.append(text)

    finish_group()

    if not groups:
        fallback = _clean_text(
            body.get_text(" ", strip=True)
        )

        if fallback and len(fallback) >= 15:
            groups.append(
                (title, title, fallback)
            )

    sections: list[ExtractedSection] = []

    for group_index, (
        heading,
        heading_path,
        text,
    ) in enumerate(groups):

        chunks = _split_text(text)

        for chunk_index, chunk in enumerate(chunks):
            # Evaluate marketing relevance and entity type
            relevance, entity_type, rel_reason = evaluate_marketing_relevance(
                page_type=page_type,
                title=heading,
                heading_path=heading_path,
                content=chunk,
            )

            (
                category,
                confidence,
                is_boilerplate,
                rejection_reason,
            ) = classify_section_details(
                title=heading,
                heading_path=heading_path,
                source_url=page_url,
                content=chunk,
                page_type=page_type,
                entity_type=entity_type,
            )

            if relevance == "irrelevant" and not is_boilerplate:
                is_boilerplate = True
                rejection_reason = rel_reason

            sections.append(
                ExtractedSection(
                    category=category,
                    title=heading[:255],
                    content=chunk,
                    source_url=page_url,
                    heading_path=heading_path[:2000],
                    section_order=len(sections),
                    metadata={
                        "page_title": title,
                        "meta_description": meta_description,
                        "page_type": page_type,
                        "entity_type": entity_type,
                        "marketing_relevance": relevance,
                        "relevance_reason": rel_reason,
                        "group_index": group_index,
                        "chunk_index": chunk_index,
                        "content_hash": hashlib.sha256(
                            chunk.encode("utf-8")
                        ).hexdigest(),
                        "confidence": confidence,
                        "is_boilerplate": is_boilerplate,
                        "rejection_reason": rejection_reason,
                    },
                )
            )

    return sections
