import re
import unicodedata
from urllib.parse import urlsplit

from bs4 import BeautifulSoup

from app.modules.company_knowledge.services.pipeline_schemas import (
    ExtractedSection,
)
from app.modules.company_knowledge.services.classification import (
    classify_section,
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
)


def _clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = "".join(
        character
        for character in value
        if character in "\n\t" or unicodedata.category(character)[0] != "C"
    )
    return re.sub(r"\s+", " ", value).strip()


def _split_text(value: str) -> list[str]:
    if len(value) <= MAX_SECTION_CHARS:
        return [value] if value else []

    chunks: list[str] = []
    current = ""
    for paragraph in re.split(r"(?<=[.!?])\s+", value):
        while len(paragraph) > MAX_SECTION_CHARS:
            if current:
                chunks.append(current)
                current = ""
            chunks.append(paragraph[:MAX_SECTION_CHARS])
            paragraph = paragraph[MAX_SECTION_CHARS:]
        if current and len(current) + len(paragraph) + 1 > MAX_SECTION_CHARS:
            chunks.append(current)
            current = paragraph
        else:
            current = f"{current} {paragraph}".strip()
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
    soup = BeautifulSoup(html or "", "html.parser")
    for node in soup.find_all(REMOVED_TAGS):
        node.decompose()
    for node in soup.select('[aria-hidden="true"], [role="navigation"]'):
        node.decompose()

    title = _clean_text(page_title or "")
    if not title and soup.title:
        title = _clean_text(soup.title.get_text(" ", strip=True))
    title = title or urlsplit(page_url).path.strip("/").replace("-", " ").title() or "Website overview"

    headings: list[tuple[int, str]] = []
    groups: list[tuple[str, str, list[str]]] = []
    current_heading = title
    current_path = ""
    current_text: list[str] = []

    def finish_group() -> None:
        text = _clean_text(" ".join(current_text))
        if text:
            groups.append((current_heading, current_path, [text]))

    body = soup.body or soup
    for element in body.find_all(
        ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "dt", "dd"]
    ):
        if element.name == "p" and element.find_parent("li") is not None:
            continue
        text = _clean_text(element.get_text(" ", strip=True))
        if not text:
            continue

        if element.name and re.fullmatch(r"h[1-6]", element.name):
            finish_group()
            level = int(element.name[1])
            headings = [
                (heading_level, heading)
                for heading_level, heading in headings
                if heading_level < level
            ]
            headings.append((level, text))
            current_path = " > ".join(heading for _, heading in headings)
            current_heading = text[:255]
            current_text = []
        else:
            current_text.append(text)

    finish_group()

    if not groups:
        plain_text = _clean_text(body.get_text(" ", strip=True))
        if plain_text:
            groups.append((title, title, [plain_text]))

    sections: list[ExtractedSection] = []
    for heading, heading_path, text_parts in groups:
        for chunk in _split_text(" ".join(text_parts)):
            section_title = heading[:255] or title[:255]
            category = classify_section(
                title=section_title,
                heading_path=heading_path,
                source_url=page_url,
                content=chunk,
            )
            sections.append(
                ExtractedSection(
                    category=category,
                    title=section_title,
                    content=chunk,
                    source_url=page_url,
                    heading_path=heading_path[:2000],
                    section_order=len(sections),
                    metadata={
                        "page_title": title,
                        "meta_description": meta_description,
                    },
                )
            )
    return sections
