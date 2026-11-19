"""Marketing relevance evaluation and business entity extraction service.

Determines whether an extracted candidate supports marketing use cases
(brand awareness, product promotion, case study proof, thought leadership,
audience targeting) and assigns a structured business entity type.
"""

from typing import Literal
import re

MARKETING_PURPOSES = (
    "brand_awareness",
    "company_introduction",
    "product_promotion",
    "service_promotion",
    "industry_marketing",
    "audience_targeting",
    "thought_leadership",
    "credibility_building",
    "case_study_promotion",
    "value_proposition",
    "content_ideation",
)

IRRELEVANT_PATTERNS = (
    "terms of service",
    "terms and conditions",
    "privacy policy",
    "cookie policy",
    "acceptable use policy",
    "all rights reserved",
    "copyright",
    "login to your account",
    "sign in",
    "register for free",
    "forgot password",
    "search this site",
    "skip to content",
    "press enter to search",
    "page not found",
    "404 error",
    "sample dashboard records",
    "illustrative demo only",
    "synthetic test data",
)


def _matches(text: str, pattern: str) -> bool:
    return bool(
        re.search(
            rf"(?<!\w){re.escape(pattern)}(?!\w)",
            text.casefold(),
        )
    )


def evaluate_marketing_relevance(
    *,
    page_type: str,
    title: str,
    heading_path: str,
    content: str,
) -> tuple[Literal["relevant", "uncertain", "irrelevant"], str, str]:
    """
    Evaluate marketing relevance and identify business entity type.

    Returns:
        (marketing_relevance, entity_type, relevance_reason)
    """
    combined = f"{title} {heading_path} {content}".casefold()

    # Rule 1: Legal or UI boilerplate is strictly irrelevant
    if page_type == "legal":
        return (
            "irrelevant",
            "legal_boilerplate",
            "Legal, compliance, and terms of service documents are excluded from marketing intelligence.",
        )

    for pattern in IRRELEVANT_PATTERNS:
        if pattern in combined:
            return (
                "irrelevant",
                "operational_boilerplate",
                f"Matches operational/legal boilerplate pattern '{pattern}'.",
            )

    # Rule 2: Minimum content length for meaningful business information
    cleaned_content = content.strip()
    if len(cleaned_content) < 25:
        return (
            "irrelevant",
            "trivial_fragment",
            "Content fragment is too short to establish an actionable marketing fact.",
        )

    # Rule 3: Case studies and client outcomes
    if page_type in ("case_study", "testimonial") or any(
        kw in combined for kw in ("case study", "customer story", "client results", "success story", "roi", "outcomes")
    ):
        return (
            "relevant",
            "proof_case_study",
            "Provides customer evidence, measurable outcomes, or verified implementations for credibility building.",
        )

    # Rule 4: Products, Platforms, and Software Offerings
    if page_type == "product" or any(
        kw in combined for kw in ("software platform", "custom visual", "proprietary tool", "saas", "dashboard tool", "appsource")
    ):
        return (
            "relevant",
            "offering_product",
            "Highlights product features, software capabilities, or commercial tooling for product promotion.",
        )

    # Rule 5: Services, Consulting, and Migrations
    if page_type == "service" or any(
        kw in combined for kw in ("consulting", "migration service", "managed services", "advisory", "implementation service", "data modernization")
    ):
        return (
            "relevant",
            "offering_service",
            "Outlines professional services, migration capabilities, and delivery expertise for service promotion.",
        )

    # Rule 6: Solutions and Domain Capabilities
    if page_type == "solution" or any(
        kw in combined for kw in ("solution", "use case", "capabilities", "business intelligence", "optimization", "workflow automation")
    ):
        return (
            "relevant",
            "offering_solution",
            "Describes business solutions and enterprise use cases for value proposition messaging.",
        )

    # Rule 7: Target Industry Expertise
    if page_type == "industry" or any(
        kw in combined for kw in ("healthcare", "financial services", "insurance", "retail", "manufacturing", "telecom", "industry expertise")
    ):
        return (
            "relevant",
            "industry_target",
            "Establishes domain vertical expertise and target audience challenges for industry-specific campaigns.",
        )

    # Rule 8: Thought Leadership and Insights
    if page_type == "blog_article" or any(
        kw in combined for kw in ("playbook", "whitepaper", "field notes", "journal", "guide", "architectural pattern", "insights")
    ):
        return (
            "relevant",
            "thought_leadership",
            "Provides educational insights, technical playbooks, and subject matter expertise for thought leadership.",
        )

    # Rule 9: Company Overview & Brand Positioning
    if page_type in ("about", "company_overview") or any(
        kw in combined for kw in ("about us", "who we are", "our mission", "founded", "differentiator", "headquarters", "core values")
    ):
        return (
            "relevant",
            "company_identity",
            "Communicates company identity, mission, positioning, and credible differentiators for brand awareness.",
        )

    # Rule 10: Partnerships and Technology Ecosystem
    if page_type == "technology_partnership" or any(
        kw in combined for kw in ("technology partner", "certified partner", "partner ecosystem", "cloud platform partner")
    ):
        return (
            "relevant",
            "partnership_tech",
            "Details certified partner status and technology alliances for co-marketing and credibility.",
        )

    # Rule 11: Careers and hiring
    if page_type == "careers" or any(
        kw in combined for kw in ("join our team", "we are hiring", "open positions", "work culture")
    ):
        return (
            "relevant",
            "employer_brand",
            "Highlights company culture and talent acquisition for employer branding.",
        )

    # Rule 12: Generic or ambiguous content staged for review
    return (
        "uncertain",
        "general_statement",
        "General company statement with indirect marketing utility; staged for human review.",
    )
