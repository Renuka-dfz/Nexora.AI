"""
Dynamic Image Prompt Builder for DataFactZ Branded Marketing Creatives.

Builds structured, rich, non-empty visual instructions for image models
(OpenRouter recraft/recraft-v3, Recraft, etc.) using the structured MarketingCreativeBrief.
"""

from __future__ import annotations

from typing import Any

from app.agents.marketing_agent.brand import get_company_brand_config
from app.agents.marketing_agent.schemas import MarketingCreativeBrief


def build_image_prompt(
    brief: MarketingCreativeBrief | dict[str, Any],
    platform: str = "instagram",
    company_name: str = "DataFactZ",
) -> str:
    """
    Construct a rich, detailed visual generation prompt from the creative brief.
    Ensures the image communicates the core business message independently.
    """
    if isinstance(brief, dict):
        headline = brief.get("headline", "AI Agents. Built for Real Work.")
        subheadline = brief.get("subheadline", "Enterprise workflows with people in control.")
        key_points = brief.get("key_points") or [
            "Understand complex data",
            "Automate repeatable tasks",
            "Keep humans in control",
        ]
        visual_concept = brief.get("visual_concept", "Enterprise AI workflow from business data to verified outcome.")
        layout_type = brief.get("layout_type", "infographic")
        topic = brief.get("topic", "Enterprise AI")
    else:
        headline = brief.headline
        subheadline = brief.subheadline
        key_points = brief.key_points or [
            "Understand complex data",
            "Automate repeatable tasks",
            "Keep humans in control",
        ]
        visual_concept = brief.visual_concept
        layout_type = brief.layout_type
        topic = brief.topic

    brand_config = get_company_brand_config(company_name)
    aspect_desc = "vertical 4:5 composition (1080x1350)" if platform == "instagram" else "landscape 16:9 composition (1200x627)"

    points_formatted = " • ".join(str(p).strip() for p in key_points[:4])

    # Dynamic center visual direction based on layout_type
    if layout_type == "process_flow":
        center_direction = (
            "CENTER SECTION (Process Flow Diagram): "
            "Illustrate a 3-step enterprise workflow: "
            "1. Business Input & Complex Data -> 2. AI Agent Processing -> 3. Human Review & Verification -> 4. Completed Work. "
            "Use clear architectural nodes, connecting directional lines, and clean document/database glyphs."
        )
    elif layout_type == "challenge_solution":
        center_direction = (
            "CENTER SECTION (Challenge vs Solution): "
            "Visual comparison diagram: Left side shows manual backlog, messy records, and slow validation; "
            "Right side shows clean automated processing, structured ledgers, and verified outcomes."
        )
    elif layout_type == "capability_overview":
        center_direction = (
            "CENTER SECTION (Capability Overview): "
            "A modern modular data architecture visualization showing enterprise data platforms flowing through "
            "specialized agent modules into trusted analytics and verified outputs."
        )
    else:  # infographic default
        center_direction = (
            "CENTER SECTION (Executive Infographic): "
            "Structured visual presentation featuring 3 distinct cards/pillars representing: "
            f"{points_formatted}. "
            "Each pillar paired with an understated professional icon and clean visual indicator."
        )

    prompt = (
        f"Create an enterprise-grade corporate marketing graphic for {brand_config['company_name']}, "
        f"following the verified visual identity of {brand_config.get('company_name', 'DataFactZ')}. "
        f"Composition: {aspect_desc}. "
        f"Color Palette: Deep charcoal canvas (#182127) with high-contrast pure white typography, "
        f"vibrant data blue (#00A4EF) and warm amber-orange (#FFB900, #F25022) visual accents. "
        f"\n\nTOP SECTION: "
        f"Official {brand_config['company_name']} brand header. "
        f"Bold editorial headline: \"{headline}\". "
        f"Supporting statement below: \"{subheadline}\". "
        f"\n\n{center_direction} "
        f"\n\nSUPPORTING SECTION: "
        f"Key enterprise value points: {points_formatted}. "
        f"\n\nFOOTER: "
        f"Restrained DataFactZ brand signature: \"Data, Analytics and AI Agents That Get Work Done\". "
        f"\n\nQUALITY & COMPOSITION REQUIREMENTS: "
        f"- The graphic must be fully readable and communicate the core value proposition independently. "
        f"- Maintain balanced intentional whitespace and a clean editorial hierarchy. "
        f"- Do NOT render empty dark void posters or title-only backgrounds. "
        f"- Do NOT render generic sci-fi robots, glowing brains, or abstract neon art. "
        f"- Do NOT fabricate metrics, certifications, or partnership logos."
    )

    return prompt.strip()
