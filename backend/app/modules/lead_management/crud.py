
"""
Nexora.AI - Lead Management CRUD

Operations:
1. Create, Read, Update, Delete Leads
2. Create and Read Lead Sources
3. Create and Read Lead Qualification Results
4. Update Qualification Results
5. Retrieve Qualification History

No AI Agent or API integration.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.lead_management.models import (
    DimLead,
    DimLeadSource,
    FactLeadQualification,
)


# =====================================================
# LEAD CRUD
# =====================================================

def create_lead(
    db: Session,
    company_id: UUID,
    full_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    organization_name: str | None = None,
    job_title: str | None = None,
    industry: str | None = None,
):
    """CREATE: Add a potential customer."""

    lead = DimLead(
        company_id=company_id,
        full_name=full_name,
        email=email,
        phone=phone,
        organization_name=organization_name,
        job_title=job_title,
        industry=industry,
        lead_status="active",
    )

    db.add(lead)
    db.commit()
    db.refresh(lead)

    return lead


def get_lead(
    db: Session,
    company_id: UUID,
    lead_id: UUID,
):
    """READ: Retrieve one lead belonging to a company."""

    return db.scalar(
        select(DimLead).where(
            DimLead.company_id == company_id,
            DimLead.lead_id == lead_id,
        )
    )


def list_leads(
    db: Session,
    company_id: UUID,
    limit: int = 50,
    offset: int = 0,
):
    """READ: Retrieve company leads with pagination."""

    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    stmt = (
        select(DimLead)
        .where(DimLead.company_id == company_id)
        .order_by(DimLead.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    return db.scalars(stmt).all()


def update_lead(
    db: Session,
    company_id: UUID,
    lead_id: UUID,
    **updates,
):
    """UPDATE: Modify an existing lead."""

    lead = get_lead(db, company_id, lead_id)

    if lead is None:
        return None

    allowed_fields = {
        "full_name",
        "email",
        "phone",
        "organization_name",
        "job_title",
        "industry",
        "lead_status",
    }

    for field, value in updates.items():
        if field not in allowed_fields:
            raise ValueError(f"Invalid update field: {field}")

        if field == "lead_status" and value not in {
            "active", "inactive", "converted"
        }:
            raise ValueError("Invalid lead status")

        setattr(lead, field, value)

    lead.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(lead)

    return lead


def delete_lead(
    db: Session,
    company_id: UUID,
    lead_id: UUID,
):
    """
    DELETE: Remove a lead.

    The database may reject deletion if qualification
    history references this lead.

    Prefer marking leads inactive when history
    must be preserved.
    """

    lead = get_lead(db, company_id, lead_id)

    if lead is None:
        return False

    db.delete(lead)
    db.commit()

    return True


# =====================================================
# LEAD SOURCE CRUD
# =====================================================

def create_lead_source(
    db: Session,
    company_id: UUID,
    source_name: str,
    source_type: str,
    source_reference: str | None = None,
):
    """CREATE: Add a lead source."""

    source = DimLeadSource(
        company_id=company_id,
        source_name=source_name,
        source_type=source_type,
        source_reference=source_reference,
    )

    db.add(source)
    db.commit()
    db.refresh(source)

    return source


def get_lead_source(
    db: Session,
    company_id: UUID,
    source_id: UUID,
):
    """READ: Retrieve a specific lead source."""

    return db.scalar(
        select(DimLeadSource).where(
            DimLeadSource.company_id == company_id,
            DimLeadSource.source_id == source_id,
        )
    )


def list_lead_sources(
    db: Session,
    company_id: UUID,
):
    """READ: Retrieve company lead sources."""

    return db.scalars(
        select(DimLeadSource).where(
            DimLeadSource.company_id == company_id
        )
    ).all()


def update_lead_source(
    db: Session,
    company_id: UUID,
    source_id: UUID,
    **updates,
):
    """UPDATE: Modify lead source details."""

    source = get_lead_source(
        db, company_id, source_id
    )

    if source is None:
        return None

    allowed_fields = {
        "source_name",
        "source_type",
        "source_reference",
    }

    for field, value in updates.items():
        if field not in allowed_fields:
            raise ValueError(f"Invalid update field: {field}")

        setattr(source, field, value)

    db.commit()
    db.refresh(source)

    return source


def delete_lead_source(
    db: Session,
    company_id: UUID,
    source_id: UUID,
):
    """
    DELETE: Remove a lead source.

    Deletion can be blocked if qualification
    records reference it.
    """

    source = get_lead_source(
        db, company_id, source_id
    )

    if source is None:
        return False

    db.delete(source)
    db.commit()

    return True


# =====================================================
# LEAD QUALIFICATION CRUD
# =====================================================

def create_lead_qualification(
    db: Session,
    company_id: UUID,
    lead_id: UUID,
    date_id: int,
    source_id: UUID | None = None,
    lead_score: int | None = None,
    confidence_score: float | None = None,
    intent_level: str = "unknown",
    qualification_status: str = "pending",
    qualification_reason: str | None = None,
    recommended_action: str | None = None,
    scoring_version: str | None = None,
):
    """
    CREATE: Store one lead qualification evaluation.

    One lead can have multiple evaluations over time.
    """

    lead = get_lead(db, company_id, lead_id)

    if lead is None:
        raise ValueError("Lead not found for this company")

    if source_id is not None:
        source = get_lead_source(
            db, company_id, source_id
        )

        if source is None:
            raise ValueError(
                "Lead source not found for this company"
            )

    if lead_score is not None and not 0 <= lead_score <= 100:
        raise ValueError("Lead score must be between 0 and 100")

    if confidence_score is not None and not 0 <= confidence_score <= 1:
        raise ValueError("Confidence must be between 0 and 1")

    if intent_level not in {"unknown", "low", "medium", "high"}:
        raise ValueError("Invalid intent level")

    if qualification_status not in {
        "pending", "qualified", "nurture", "unqualified"
    }:
        raise ValueError("Invalid qualification status")

    qualification = FactLeadQualification(
        company_id=company_id,
        lead_id=lead_id,
        source_id=source_id,
        date_id=date_id,
        lead_score=lead_score,
        confidence_score=confidence_score,
        intent_level=intent_level,
        qualification_status=qualification_status,
        qualification_reason=qualification_reason,
        recommended_action=recommended_action,
        scoring_version=scoring_version,
        evaluated_at=datetime.now(timezone.utc),
    )

    db.add(qualification)
    db.commit()
    db.refresh(qualification)

    return qualification


def get_lead_qualification(
    db: Session,
    company_id: UUID,
    qualification_id: UUID,
):
    """READ: Retrieve one qualification record."""

    return db.scalar(
        select(FactLeadQualification).where(
            FactLeadQualification.company_id == company_id,
            FactLeadQualification.qualification_id == qualification_id,
        )
    )


def get_lead_qualification_history(
    db: Session,
    company_id: UUID,
    lead_id: UUID,
):
    """READ: Retrieve all evaluations of a lead."""

    stmt = (
        select(FactLeadQualification)
        .where(
            FactLeadQualification.company_id == company_id,
            FactLeadQualification.lead_id == lead_id,
        )
        .order_by(
            FactLeadQualification.evaluated_at.desc()
        )
    )

    return db.scalars(stmt).all()


def get_latest_lead_qualification(
    db: Session,
    company_id: UUID,
    lead_id: UUID,
):
    """READ: Retrieve the most recent evaluation."""

    stmt = (
        select(FactLeadQualification)
        .where(
            FactLeadQualification.company_id == company_id,
            FactLeadQualification.lead_id == lead_id,
        )
        .order_by(
            FactLeadQualification.evaluated_at.desc()
        )
        .limit(1)
    )

    return db.scalar(stmt)


def update_lead_qualification(
    db: Session,
    company_id: UUID,
    qualification_id: UUID,
    **updates,
):
    """UPDATE: Modify qualification results."""

    qualification = get_lead_qualification(
        db, company_id, qualification_id
    )

    if qualification is None:
        return None

    allowed_fields = {
        "lead_score",
        "confidence_score",
        "intent_level",
        "qualification_status",
        "qualification_reason",
        "recommended_action",
        "scoring_version",
    }

    for field, value in updates.items():
        if field not in allowed_fields:
            raise ValueError(f"Invalid update field: {field}")

        if field == "lead_score" and value is not None:
            if not 0 <= value <= 100:
                raise ValueError("Lead score must be 0-100")

        if field == "confidence_score" and value is not None:
            if not 0 <= value <= 1:
                raise ValueError("Confidence must be 0-1")

        if field == "intent_level" and value not in {
            "unknown", "low", "medium", "high"
        }:
            raise ValueError("Invalid intent level")

        if field == "qualification_status" and value not in {
            "pending", "qualified", "nurture", "unqualified"
        }:
            raise ValueError("Invalid qualification status")

        setattr(qualification, field, value)

    db.commit()
    db.refresh(qualification)

    return qualification


def delete_lead_qualification(
    db: Session,
    company_id: UUID,
    qualification_id: UUID,
):
    """DELETE: Remove one qualification record."""

    qualification = get_lead_qualification(
        db, company_id, qualification_id
    )

    if qualification is None:
        return False

    db.delete(qualification)
    db.commit()

    return True
