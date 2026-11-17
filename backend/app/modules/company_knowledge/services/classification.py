import re


CATEGORY_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "Careers",
        ("career", "careers", "job opening", "jobs", "employment", "work with us"),
    ),
    (
        "Contact Information",
        ("contact", "get in touch", "phone", "email us", "address"),
    ),
    (
        "Pricing",
        ("pricing", "price", "plans", "cost", "subscription"),
    ),
    (
        "Case Studies",
        ("case study", "case studies", "customer story", "success story"),
    ),
    (
        "Customers",
        ("customer", "customers", "client", "clients", "testimonial"),
    ),
    (
        "Industry Expertise",
        ("industry", "industries", "sector", "sectors"),
    ),
    (
        "Products",
        ("product", "products", "pricing", "plan", "feature"),
    ),
    (
        "Technology Stack",
        ("technology", "tech stack", "platform", "architecture", "integration"),
    ),
    (
        "Innovations and Research",
        ("research", "innovation", "innovations", "patent", "laboratory"),
    ),
    (
        "Projects",
        ("project", "projects", "portfolio"),
    ),
    (
        "Achievements",
        ("achievement", "award", "recognition", "certification"),
    ),
    (
        "Brand Identities",
        ("brand", "mission", "vision", "values"),
    ),
    (
        "Solutions",
        ("solution", "solutions", "use case", "use cases"),
    ),
    (
        "Services",
        ("service", "services", "consulting", "support"),
    ),
    (
        "Company Overview",
        ("about", "company", "who we are", "overview"),
    ),
)


def classify_section(
    *,
    title: str,
    heading_path: str,
    source_url: str,
    content: str,
) -> str:
    searchable = " ".join(
        (heading_path, title, source_url, content[:1200])
    ).casefold()

    for category, keywords in CATEGORY_RULES:
        for keyword in keywords:
            if re.search(
                rf"(?<!\w){re.escape(keyword)}(?!\w)",
                searchable,
            ):
                return category

    return "Company Overview"
