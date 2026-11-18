"""Page understanding service for website intelligence extraction.

Detects high-level page types (e.g. product, service, solution, case_study,
blog_article, company_overview, legal) using multi-signal analysis across URL path,
page title, meta description, and primary headings.
"""

import re
from urllib.parse import urlsplit


PAGE_TYPE_SIGNALS: dict[str, tuple[str, ...]] = {
    "legal": (
        "terms of service", "terms and conditions", "privacy policy",
        "cookie policy", "legal notice", "acceptable use", "disclaimer",
        "terms of use", "gdpr",
    ),
    "contact": (
        "contact us", "contact", "get in touch", "locations", "offices",
        "reach out", "support", "help center",
    ),
    "careers": (
        "careers", "career", "job opening", "jobs", "employment",
        "join us", "work with us", "hiring",
    ),
    "case_study": (
        "case study", "case studies", "success stories", "success story",
        "customer story", "customer stories", "client results", "client stories",
    ),
    "testimonial": (
        "testimonials", "testimonial", "reviews", "customer feedback",
    ),
    "industry": (
        "industries", "industry", "sectors", "sector", "healthcare",
        "financial services", "banking", "insurance", "retail",
        "manufacturing", "telecom", "energy", "public sector",
    ),
    "product": (
        "products", "product", "software", "platform", "app", "tool",
        "visuals", "extension", "plugin", "features", "pricing",
        "agent", "agents", "ai agent", "ai agents",
    ),
    "service": (
        "services", "service", "consulting", "advisory", "implementation",
        "migration", "modernization", "managed services", "onboarding",
    ),
    "solution": (
        "solutions", "solution", "use cases", "use case", "capabilities",
        "analytics", "business intelligence", "optimization", "automation",
    ),
    "technology_partnership": (
        "partnerships", "partners", "technology partners", "integrations",
        "tech stack", "ecosystem", "alliance",
    ),
    "blog_article": (
        "blog", "ai journal", "journal", "articles", "article",
        "whitepaper", "whitepapers", "playbook", "playbooks", "guides",
        "guide", "insights", "thought leadership", "newsletter",
    ),
    "news_announcement": (
        "news", "press", "press release", "announcements", "media",
    ),
    "about": (
        "about us", "about", "who we are", "leadership", "our team",
        "company history", "mission and values",
    ),
}


def _matches(text: str, keyword: str) -> bool:
    return bool(
        re.search(
            rf"(?<!\w){re.escape(keyword)}(?!\w)",
            text.casefold(),
        )
    )


def detect_page_type(
    *,
    page_url: str,
    title: str | None,
    meta_description: str | None,
    main_headings: list[str] | None = None,
) -> str:
    """
    Detect page type from URL, title, metadata, and headings.

    Returns canonical page type string.
    """
    url_path = (
        urlsplit(page_url)
        .path.strip("/")
        .replace("-", " ")
        .replace("_", " ")
        .casefold()
    )
    title_str = (title or "").casefold()
    meta_str = (meta_description or "").casefold()
    headings_str = " ".join(main_headings or []).casefold()

    # Fast-path: root / homepage is company_overview
    if not url_path or url_path in ("", "index", "home"):
        return "company_overview"

    # Fast-path for legal pages
    for legal_kw in PAGE_TYPE_SIGNALS["legal"]:
        if legal_kw in url_path or legal_kw in title_str:
            return "legal"

    scores: dict[str, int] = {}

    for page_type, keywords in PAGE_TYPE_SIGNALS.items():
        score = 0
        for kw in keywords:
            if _matches(url_path, kw):
                score += 5
            if _matches(title_str, kw):
                score += 4
            if _matches(headings_str, kw):
                score += 3
            if _matches(meta_str, kw):
                score += 2
        if score > 0:
            scores[page_type] = score

    if not scores:
        return "unknown"

    # Highest score wins; deterministic tie-breaking
    best_type = max(scores, key=lambda k: (scores[k], -len(k)))
    return best_type
