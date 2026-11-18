"""Deterministic, marketing-aligned company knowledge classification.

Maps business entities to the 16 authoritative categories in dim_category
using multi-tier structural evidence across page type, entity type,
heading hierarchy, page title, URL path, and textual content.
"""

from typing import Any
import re
from urllib.parse import urlsplit

from app.modules.company_knowledge.services.page_understanding import (
    detect_page_type,
)

CATEGORY_RULES: dict[str, tuple[str, ...]] = {
    "Careers": (
        "career", "careers", "job opening", "jobs", "employment",
        "work with us", "hiring", "open positions", "join our team",
    ),
    "Contact Information": (
        "contact", "contact us", "get in touch", "phone", "email us",
        "address", "headquarters", "office location", "reach out",
    ),
    "Pricing": (
        "pricing", "price", "pricing plans", "subscription plans",
        "pricing tier", "cost per month", "billing", "$ / mo",
        "$ / month", "annual billing", "monthly billing", "license pricing",
    ),
    "Knowledge Resources": (
        "journal", "ai journal", "blog", "blogs", "article", "articles",
        "whitepaper", "whitepapers", "playbook", "playbooks", "guide",
        "guides", "glossary", "faq", "frequently asked questions",
        "documentation", "insights", "newsletter", "publication", "reports",
    ),
    "Case Studies": (
        "case study", "case studies", "customer story", "customer stories",
        "success story", "success stories", "client success", "customer success",
        "client story", "client results", "customer outcome", "business impact",
        "customer spotlight", "client outcome",
    ),
    "Customers": (
        "customer", "customers", "client", "clients", "testimonial",
        "testimonials", "trusted by", "our clients",
    ),
    "Industry Expertise": (
        "industry", "industries", "sector", "sectors", "healthcare",
        "financial services", "banking", "insurance", "retail",
        "manufacturing", "telecommunications", "telecom", "energy",
    ),
    "Products": (
        "product", "products", "software", "platform", "app", "tool",
        "dashboard", "visuals", "plugin", "extension", "license", "appsource",
        "canvas", "powermigrate", "copilot", "autonomous agent", "agent",
        "agents", "ai agent", "ai agents",
    ),
    "Solutions": (
        "solution", "solutions", "use case", "use cases", "capabilities",
        "analytics", "business intelligence", "reporting", "decision support",
        "forecasting", "optimization", "optimisation", "workflow automation",
        "agentic workflow", "data foundations", "governance", "edge ai",
    ),
    "Services": (
        "service", "services", "consulting", "advisory", "implementation",
        "migration", "modernization", "modernise", "managed services",
        "onboarding", "support", "delivery", "custom development",
        "data engineering", "architecture design", "methodology",
    ),
    "Technology Stack": (
        "tech stack", "technology stack", "technologies", "architecture",
        "platform architecture", "partner ecosystem", "technology partner",
        "partnerships", "infrastructure", "supported platforms", "integrations",
        "technology",
    ),
    "Innovations and Research": (
        "research", "innovation", "innovations", "patent", "patents",
        "laboratory", "lab", "papers",
    ),
    "Projects": (
        "project", "projects", "portfolio", "engagements",
    ),
    "Achievements": (
        "achievement", "achievements", "award", "awards", "recognition",
        "certification", "certifications", "accreditation",
    ),
    "Brand Identities": (
        "brand", "mission", "vision", "values", "core values", "our ethos",
    ),
    "Company Overview": (
        "about", "company", "who we are", "overview", "our story", "leadership",
    ),
}

PAGE_TYPE_CATEGORY_PRIORS: dict[str, str] = {
    "product": "Products",
    "service": "Services",
    "solution": "Solutions",
    "case_study": "Case Studies",
    "testimonial": "Customers",
    "industry": "Industry Expertise",
    "technology_partnership": "Technology Stack",
    "blog_article": "Knowledge Resources",
    "careers": "Careers",
    "about": "Company Overview",
    "company_overview": "Company Overview",
    "contact": "Contact Information",
}

TECH_NAMES = (
    "snowflake", "databricks", "aws", "azure", "power bi",
    "fabric", "tableau", "postgresql", "python", "llm", "embeddings",
)

PRICING_EXCLUSIONS = (
    "incentive plan", "compensation plan", "payout", "migration plan",
    "project plan", "action plan", "implementation plan",
)


LEGAL_KEYWORDS = (
    "terms of service", "terms and conditions", "privacy policy",
    "cookie policy", "legal notice", "acceptable use policy",
    "all rights reserved",
)


def is_legal_boilerplate(
    title: str,
    heading_path: str,
    source_url: str,
    content: str,
) -> bool:
    """Detect legal boilerplate (terms of service, privacy policy, etc.)."""
    combined = f"{title} {heading_path} {source_url} {content}".casefold()
    return any(kw in combined for kw in LEGAL_KEYWORDS)


def _matches(text: str, keyword: str) -> bool:
    return bool(
        re.search(
            rf"(?<!\w){re.escape(keyword)}(?!\w)",
            text.casefold(),
        )
    )


def classify_section_details(
    *,
    title: str,
    heading_path: str,
    source_url: str,
    content: str,
    page_type: str = "unknown",
    entity_type: str = "general",
) -> tuple[str, float, bool, str | None]:
    """
    Classify a section with evidence confidence and boilerplate detection.

    Returns:
        (category, confidence, is_boilerplate, rejection_reason)
    """
    if (
        entity_type == "legal_boilerplate"
        or page_type == "legal"
        or is_legal_boilerplate(title, heading_path, source_url, content)
    ):
        return (
            "Company Overview",
            0.1,
            True,
            "legal_compliance_boilerplate",
        )

    if entity_type == "operational_boilerplate":
        return (
            "Company Overview",
            0.1,
            True,
            "operational_boilerplate",
        )

    url_path = (
        urlsplit(source_url)
        .path.replace("-", " ")
        .replace("_", " ")
    )

    scores: dict[str, int] = {}

    leaf_heading = (
        heading_path.split(">")[-1].strip()
        if heading_path
        else title
    )

    if page_type == "unknown":
        page_type = detect_page_type(
            page_url=source_url,
            title=title,
            meta_description=None,
            main_headings=[leaf_heading] if leaf_heading else None,
        )

    leaf_lower = leaf_heading.casefold()
    content_lower = content.casefold()
    url_lower = url_path.casefold()

    # Prior bonus based on detected page type
    prior_category = PAGE_TYPE_CATEGORY_PRIORS.get(page_type)
    if prior_category:
        scores[prior_category] = scores.get(prior_category, 0) + 4

    for category, words in CATEGORY_RULES.items():
        eligible_words = []
        for word in words:
            if category == "Pricing" and word in ("price", "pricing", "pricing plans"):
                if any(
                    ex in leaf_lower or ex in content_lower
                    for ex in PRICING_EXCLUSIONS
                ):
                    continue
            if category == "Services" and word in ("service", "services"):
                if "terms of service" in leaf_lower or "terms of service" in url_lower:
                    continue
            eligible_words.append(word)

        if not eligible_words:
            continue

        leaf_hit = any(_matches(leaf_heading, w) for w in eligible_words)
        title_hit = any(_matches(title, w) for w in eligible_words)
        url_hit = any(_matches(url_path, w) for w in eligible_words)
        hpath_hit = any(_matches(heading_path, w) for w in eligible_words)
        content_hit = any(_matches(content, w) for w in eligible_words)

        score = scores.get(category, 0)
        if leaf_hit:
            score += 10
        if title_hit:
            score += 5
        if url_hit:
            score += 4
        if hpath_hit:
            score += 3
        if content_hit:
            score += 2

        # Vendor technology names contribute as supportive context (+3/+2) to Technology Stack
        if category == "Technology Stack":
            if any(_matches(leaf_heading, t) for t in TECH_NAMES):
                score += 3
            if any(_matches(url_path, t) for t in TECH_NAMES):
                score += 2

        # Disambiguate delivery steps (Step 01 Discover...) -> Services, not Products
        if category == "Products" and re.search(r"step\s+\d+", leaf_lower):
            score = 0

        if score > 0:
            scores[category] = score

    # Leadership and team bios on About page belong in Company Overview
    if (
        page_type in ("about", "company_overview")
        and any(
            term in heading_path.casefold()
            for term in (
                "people accountable",
                "leadership",
                "our team",
                "management team",
                "board of directors",
                "executive team",
            )
        )
    ):
        scores["Company Overview"] = scores.get("Company Overview", 0) + 15

    if not scores:
        return ("Company Overview", 0.20, False, None)

    best_category = min(
        scores,
        key=lambda category: (
            -scores[category],
            category,
        ),
    )
    best_score = scores[best_category]
    confidence = 0.90 if best_score >= 10 else (0.70 if best_score >= 5 else 0.45)

    return (best_category, confidence, False, None)


def classify_section(
    *,
    title: str,
    heading_path: str,
    source_url: str,
    content: str,
    page_type: str = "unknown",
) -> str:
    """Classify section returning the canonical category name."""
    category, _, _, _ = classify_section_details(
        title=title,
        heading_path=heading_path,
        source_url=source_url,
        content=content,
        page_type=page_type,
    )
    return category
