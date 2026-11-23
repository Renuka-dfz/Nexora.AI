"""
Nexora.AI - Structured PostgreSQL Company Knowledge Service.

Provides company-scoped direct ORM access to authoritative Company Intelligence facts
persisted in PostgreSQL (fact_company_intelligence joined with dim_category and dim_source).

Guarantees:
- Strict company isolation (company_id enforcement on every query)
- Strict currency enforcement (is_current = TRUE)
- Fail-closed verification policy (verification_status IN ('verified', 'approved'))
- Supports all 16 Company Intelligence categories
- No N+1 queries: single joined select
- No LLM-generated SQL: parameterized SQLAlchemy ORM queries only
"""

from __future__ import annotations

import logging
from typing import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    DimCategory,
    DimSource,
    FactCompanyIntelligence,
)
from app.modules.company_knowledge.schemas import StructuredFactRead

logger = logging.getLogger(__name__)

# Permitted trusted statuses for authoritative company knowledge
DEFAULT_TRUSTED_STATUSES = frozenset({"verified", "approved"})

# All 16 Company Intelligence categories supported by Nexora.AI
ALL_COMPANY_CATEGORIES = [
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Projects",
    "Innovations and Research",
    "Brand Identities",
    "Knowledge Resources",
    "Case Studies",
    "Achievements",
    "Industry Expertise",
    "Customers",
    "Contact Information",
    "Pricing",
    "Solutions",
    "Careers",
]


def get_structured_facts(
    db: Session,
    *,
    company_id: UUID,
    categories: Sequence[str] | None = None,
    verification_statuses: Sequence[str] | None = None,
    limit: int = 50,
) -> list[StructuredFactRead]:
    """
    Retrieve authoritative company facts directly from PostgreSQL.

    Args:
        db: SQLAlchemy database session.
        company_id: Authorized company UUID.
        categories: Optional list of category names (case-insensitive filter).
        verification_statuses: Optional verification statuses (defaults to verified, approved).
        limit: Maximum number of facts to return (default: 50).

    Returns:
        List of typed StructuredFactRead items.
    """
    if limit < 1:
        raise ValueError("limit must be positive")

    allowed_statuses = (
        set(verification_statuses)
        if verification_statuses is not None
        else DEFAULT_TRUSTED_STATUSES
    )

    statement = (
        select(
            FactCompanyIntelligence,
            DimCategory.category_name,
            DimSource.source_url,
            DimSource.page_title,
        )
        .join(
            DimCategory,
            DimCategory.category_id == FactCompanyIntelligence.category_id,
        )
        .join(
            DimSource,
            DimSource.source_id == FactCompanyIntelligence.source_id,
        )
        .where(
            FactCompanyIntelligence.company_id == company_id,
            FactCompanyIntelligence.is_current.is_(True),
            FactCompanyIntelligence.verification_status.in_(allowed_statuses),
        )
    )

    clean_categories = [c.strip() for c in categories if c.strip()] if categories else []
    facts: list[StructuredFactRead] = []

    if len(clean_categories) > 1:
        # Balanced category retrieval: fetch a fair quota per category
        # to prevent alphabetical bias (e.g. "Brand Identities" crowding out "Products")
        per_cat_limit = max(5, (limit + len(clean_categories) - 1) // len(clean_categories))
        seen_fact_ids = set()

        for cat in clean_categories:
            if len(facts) >= limit:
                break
            stmt = (
                statement.where(
                    func.lower(DimCategory.category_name) == cat.casefold()
                )
                .order_by(
                    FactCompanyIntelligence.section_order.asc().nulls_last(),
                    FactCompanyIntelligence.fact_id.asc(),
                )
                .limit(per_cat_limit)
            )
            cat_rows = db.execute(stmt).all()
            for fact_row, category_name, source_url, page_title in cat_rows:
                if fact_row.fact_id not in seen_fact_ids:
                    seen_fact_ids.add(fact_row.fact_id)
                    facts.append(
                        StructuredFactRead(
                            fact_id=fact_row.fact_id,
                            company_id=fact_row.company_id,
                            category_id=fact_row.category_id,
                            category_name=category_name,
                            title=fact_row.title,
                            description=fact_row.description,
                            source_url=source_url,
                            heading_path=fact_row.heading_path,
                            verification_status=fact_row.verification_status,
                            is_current=fact_row.is_current,
                            extracted_at=fact_row.extracted_at,
                            page_title=page_title,
                        )
                    )
                    if len(facts) >= limit:
                        break
    else:
        if len(clean_categories) == 1:
            statement = statement.where(
                func.lower(DimCategory.category_name) == clean_categories[0].casefold()
            )

        statement = (
            statement.order_by(
                DimCategory.category_name.asc(),
                FactCompanyIntelligence.section_order.asc().nulls_last(),
                FactCompanyIntelligence.fact_id.asc(),
            )
            .limit(limit)
        )

        rows = db.execute(statement).all()
        for fact_row, category_name, source_url, page_title in rows:
            facts.append(
                StructuredFactRead(
                    fact_id=fact_row.fact_id,
                    company_id=fact_row.company_id,
                    category_id=fact_row.category_id,
                    category_name=category_name,
                    title=fact_row.title,
                    description=fact_row.description,
                    source_url=source_url,
                    heading_path=fact_row.heading_path,
                    verification_status=fact_row.verification_status,
                    is_current=fact_row.is_current,
                    extracted_at=fact_row.extracted_at,
                    page_title=page_title,
                )
            )

    logger.debug(
        "Retrieved %d structured facts for company %s",
        len(facts),
        company_id,
        extra={
            "company_id": str(company_id),
            "count": len(facts),
            "categories": categories,
        },
    )

    return facts


# =====================================================
# CONVENIENCE HELPERS FOR COMMON MARKETING CATEGORIES
# =====================================================

def get_company_overview(
    db: Session,
    company_id: UUID,
    limit: int = 10,
) -> list[StructuredFactRead]:
    """Retrieve verified company overview facts."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Company Overview"],
        limit=limit,
    )


def get_company_services(
    db: Session,
    company_id: UUID,
    limit: int = 50,
) -> list[StructuredFactRead]:
    """Retrieve verified company services."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Services"],
        limit=limit,
    )


def get_company_products(
    db: Session,
    company_id: UUID,
    limit: int = 50,
) -> list[StructuredFactRead]:
    """Retrieve verified company products."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Products"],
        limit=limit,
    )


def get_company_tech_stack(
    db: Session,
    company_id: UUID,
    limit: int = 50,
) -> list[StructuredFactRead]:
    """Retrieve verified technology stack facts."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Technology Stack"],
        limit=limit,
    )


def get_company_solutions(
    db: Session,
    company_id: UUID,
    limit: int = 30,
) -> list[StructuredFactRead]:
    """Retrieve verified company solutions."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Solutions"],
        limit=limit,
    )


def get_company_contact_info(
    db: Session,
    company_id: UUID,
    limit: int = 20,
) -> list[StructuredFactRead]:
    """Retrieve verified contact information facts."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Contact Information"],
        limit=limit,
    )


def get_company_pricing(
    db: Session,
    company_id: UUID,
    limit: int = 20,
) -> list[StructuredFactRead]:
    """Retrieve verified pricing facts."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Pricing"],
        limit=limit,
    )


def get_company_case_studies_structured(
    db: Session,
    company_id: UUID,
    limit: int = 20,
) -> list[StructuredFactRead]:
    """Retrieve verified structured case study facts."""
    return get_structured_facts(
        db,
        company_id=company_id,
        categories=["Case Studies"],
        limit=limit,
    )
