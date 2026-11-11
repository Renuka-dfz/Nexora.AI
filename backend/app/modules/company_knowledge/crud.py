
"""
Nexora.AI - Company Intelligence CRUD

Handles:
- Reading companies
- Reading categories
- Creating and retrieving sources
- Creating extracted information
- Reading extracted information
- Updating extracted information
- Deleting extracted information

Crawl4AI integration will be added later.
"""

from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.models import (
    DimCompany,
    DimCategory,
    DimSource,
    FactCompanyIntelligence,
)


# ==================================================
# COMPANY - READ
# ==================================================

def get_company(
    db: Session,
    company_id: UUID,
):
    return db.get(DimCompany, company_id)


# ==================================================
# CATEGORY - READ
# ==================================================

def get_categories(db: Session):
    return db.scalars(
        select(DimCategory).order_by(
            DimCategory.category_id
        )
    ).all()


def get_category_by_name(
    db: Session,
    category_name: str,
):
    return db.scalar(
        select(DimCategory).where(
            DimCategory.category_name == category_name
        )
    )


# ==================================================
# SOURCE - CREATE / READ
# ==================================================

def get_or_create_source(
    db: Session,
    company_id: UUID,
    source_url: str,
):
    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_url == source_url,
        )
    )

    if source is None:
        source = DimSource(
            company_id=company_id,
            source_url=source_url,
            source_type="website",
        )

        db.add(source)
        db.flush()

    return source


# ==================================================
# COMPANY INTELLIGENCE - CREATE
# ==================================================

def create_company_information(
    db: Session,
    company_id: UUID,
    category_id: int,
    source_id: UUID,
    title: str,
    description: str,
):
    fact = FactCompanyIntelligence(
        company_id=company_id,
        category_id=category_id,
        source_id=source_id,
        title=title,
        description=description,
        verification_status="pending",
        extracted_at=datetime.now(timezone.utc),
    )

    db.add(fact)
    db.commit()
    db.refresh(fact)

    return fact


# ==================================================
# COMPANY INTELLIGENCE - READ
# ==================================================

def get_company_information(
    db: Session,
    company_id: UUID,
):
    return db.scalars(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.company_id
            == company_id
        )
    ).all()


def get_information_by_category(
    db: Session,
    company_id: UUID,
    category_id: int,
):
    return db.scalars(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.company_id
            == company_id,
            FactCompanyIntelligence.category_id
            == category_id,
        )
    ).all()


# ==================================================
# COMPANY INTELLIGENCE - UPDATE
# ==================================================

def update_company_information(
    db: Session,
    company_id: UUID,
    fact_id: UUID,
    title: str | None = None,
    description: str | None = None,
):
    fact = db.scalar(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.fact_id == fact_id,
            FactCompanyIntelligence.company_id == company_id,
        )
    )

    if fact is None:
        return None

    if title is not None:
        fact.title = title

    if description is not None:
        fact.description = description

    fact.verification_status = "pending"

    db.commit()
    db.refresh(fact)

    return fact


# ==================================================
# COMPANY INTELLIGENCE - DELETE
# ==================================================

def delete_company_information(
    db: Session,
    company_id: UUID,
    fact_id: UUID,
):
    fact = db.scalar(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.fact_id == fact_id,
            FactCompanyIntelligence.company_id == company_id,
        )
    )

    if fact is None:
        return False

    db.delete(fact)
    db.commit()

    return True
