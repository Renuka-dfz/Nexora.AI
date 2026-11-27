"""
DataFactZ Official Brand Reference & Visual Identity Configuration.

Extracted directly from https://datafactz.ai/ and verified crawl assets:
- Official Company Name: DataFactZ
- Consultancy Since: 2004
- Tagline: "Data, Analytics and AI Agents That Get Work Done"
- Official Brand Logos:
    https://datafactz.ai/brand/datafactz-logo-dark.png
    https://datafactz.ai/brand/datafactz-logo.png
"""

from __future__ import annotations

from typing import Any

# Verified Color Palette from datafactz.ai design tokens & styles
DATAFACTZ_BRAND_PALETTE: dict[str, str] = {
    "surface_dark": "#182127",       # Primary dark charcoal/slate canvas
    "surface_deep": "#0E151A",       # Deep contrast background
    "surface_card": "#1F2B33",       # Container/card surface
    "primary_blue": "#00A4EF",       # DataFactZ signature cloud & data blue
    "accent_amber": "#FFB900",       # Warm amber highlight
    "accent_orange": "#F25022",      # Energy orange
    "accent_green": "#7FBA00",       # Verified/operational green
    "text_primary": "#FFFFFF",       # Pure white editorial headlines
    "text_secondary": "#E2E8F0",     # Crisp readable body text
    "text_muted": "#94A3B8",         # Muted captions & metadata
    "border_subtle": "#2A3B47",      # Clean card borders
}

# Typography & Spacing
DATAFACTZ_TYPOGRAPHY = {
    "headline_font": "sans-serif",
    "headline_weight": "bold",
    "body_font": "sans-serif",
    "body_weight": "normal",
    "border_radius": 16,
    "line_height": 1.25,
}

# Verified Core Service Offerings & Approved Terminology
DATAFACTZ_APPROVED_SERVICES = [
    {
        "name": "Enterprise AI Agents",
        "description": "Production-grade AI agents built on a contract, in your cloud, with people in control.",
        "examples": [
            "Partner Data Intake (insurance bordereaux to clean ledgers)",
            "Site Intelligence (cited site histories for geotechnical & environmental engineering)",
            "Field Records (handwritten inspection logs to structured data)",
            "Incentive Compensation (complex sales commission simulation & dispute prevention)",
        ],
    },
    {
        "name": "Governed Data Foundations",
        "description": "Enterprise data engineering, pipeline modernization, and cloud data architecture.",
        "examples": [
            "Data pipeline orchestration",
            "Data governance & lineage",
            "Edge AI and cloud data platforms",
        ],
    },
    {
        "name": "Analytics & Power BI Consulting",
        "description": "Full-lifecycle enterprise BI, modern dashboard design, and migration acceleration.",
        "examples": [
            "Migration Hub: Tableau, Spotfire, Qlik, MicroStrategy to Power BI",
            "Canvas for Power BI custom visuals",
            "Advanced machine learning & predictive modeling",
        ],
    },
]

DATAFACTZ_FOUR_STEP_METHOD = [
    "Step 01: Discover — Workshop with the business owner, mapping decisions and workflows.",
    "Step 02: Build — Proven production components customized with your domain rules.",
    "Step 03: Validate — Run side-by-side with real workloads to confirm accuracy.",
    "Step 04: Launch & Run — Deploy in your cloud tenant, managed by your team or ours.",
]


def get_company_brand_config(company_name: str | None = None) -> dict[str, Any]:
    """
    Return the structured brand configuration.
    Defaults to official DataFactZ branding as the primary reference.
    """
    is_datafactz = True
    if company_name and "datafactz" not in company_name.lower():
        is_datafactz = False

    if is_datafactz:
        return {
            "company_name": "DataFactZ",
            "tagline": "Data, Analytics and AI Agents That Get Work Done",
            "founded_year": 2004,
            "palette": DATAFACTZ_BRAND_PALETTE,
            "typography": DATAFACTZ_TYPOGRAPHY,
            "logo_dark_url": "https://datafactz.ai/brand/datafactz-logo-dark.png",
            "logo_light_url": "https://datafactz.ai/brand/datafactz-logo.png",
            "approved_services": DATAFACTZ_APPROVED_SERVICES,
            "methodology": DATAFACTZ_FOUR_STEP_METHOD,
            "visual_style": (
                "Sophisticated enterprise AI and data consulting creative. "
                "Crisp white editorial typography on deep charcoal (#182127) canvas. "
                "Vibrant data-blue (#00A4EF) and warm amber (#FFB900) accents. "
                "Structured cards, process diagrams, and clear numbered points. "
                "No generic cyberpunk art, no floating brains, and no title-only empty posters."
            ),
        }

    # Clean fallback for other enterprise tenants
    return {
        "company_name": company_name or "Enterprise AI Solutions",
        "tagline": "Enterprise Data and AI Solutions",
        "palette": {
            "surface_dark": "#14211C",
            "primary_blue": "#256D58",
            "accent_amber": "#34D399",
            "text_primary": "#FFFFFF",
            "text_secondary": "#E2E8F0",
        },
        "visual_style": "Polished corporate enterprise marketing creative with clear visual hierarchy.",
    }


def get_brand_knowledge_context() -> dict[str, Any]:
    """
    Return formatted DataFactZ company knowledge context and structured facts.
    Used for grounding and as an authoritative fallback when pgvector is cold.
    """
    context_lines = [
        "# Official Company Knowledge: DataFactZ (https://datafactz.ai/)",
        "DataFactZ is an enterprise data, analytics, and AI consultancy founded in 2004.",
        "Tagline: Data, Analytics and AI Agents That Get Work Done.",
        "",
        "## Core Offerings & Capability Pillars:",
        "1. Enterprise AI Agents: Production-grade autonomous agents built on contract in client cloud tenants with human oversight.",
        "   - Partner Data Intake: Converts complex partner files and insurance bordereaux into clean general ledgers.",
        "   - Site Intelligence: Surfaces cited site histories for geotechnical and environmental engineering.",
        "   - Field Records: Ingests unstructured and handwritten inspection logs into structured enterprise databases.",
        "   - Incentive Compensation: Simulates complex sales commissions, prevents dispute bottlenecks, and ensures deterministic payouts.",
        "2. Governed Data Foundations: Enterprise data engineering, unified semantic models, data governance, lineage, and zero-hallucination pipelines.",
        "3. Analytics & Power BI Consulting: Migration Hub for Tableau/Spotfire/Qlik to Microsoft Power BI, custom Canvas visuals, and enterprise ML.",
        "",
        "## 4-Step Delivery Methodology:",
        "- Step 01 (Discover): Workshop with business owners, mapping workflow decisions.",
        "- Step 02 (Build): Proven production components customized with client domain rules.",
        "- Step 03 (Validate): Side-by-side run with real workloads confirming accuracy.",
        "- Step 04 (Launch & Run): Deployed in client cloud tenants, human-monitored.",
    ]
    structured_facts = [
        {"fact_id": "dfz-1", "category": "Capabilities", "fact_text": "DataFactZ delivers enterprise AI agents for partner data intake, site intelligence, field records, and incentive compensation.", "source_url": "https://datafactz.ai/"},
        {"fact_id": "dfz-2", "category": "Governance", "fact_text": "Governed data foundations ensure enterprise semantic architecture, data lineage, and zero-hallucination pipelines.", "source_url": "https://datafactz.ai/"},
        {"fact_id": "dfz-3", "category": "Modernization", "fact_text": "Analytics & Power BI consulting includes automated Migration Hub from Tableau/Qlik to Power BI.", "source_url": "https://datafactz.ai/"},
        {"fact_id": "dfz-4", "category": "Methodology", "fact_text": "DataFactZ 4-step delivery method: Discover, Build, Validate, Launch & Run.", "source_url": "https://datafactz.ai/"},
    ]
    return {
        "context_text": "\n".join(context_lines),
        "structured_facts": structured_facts,
    }
