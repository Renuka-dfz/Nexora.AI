"""
Nexora.AI - Lead Qualification Agent Authorized Tools.

Exposes typed tool interfaces for:
- Fetching and creating lead records (dim_lead)
- Retrieving relevant company solutions & offerings (Company Knowledge Layer)
- Reading prior lead qualification history
- Persisting qualification evaluations and recommendations (fact_lead_qualification)
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.company_knowledge.schemas import CompanyKnowledgeContext
from app.modules.company_knowledge.services.agent_integration import (
    get_lead_knowledge_context,
)
from app.modules.lead_management.models import (
    DimLead,
    DimLeadSource,
    FactLeadQualification,
)
from app.modules.marketing.models import DimDate

logger = logging.getLogger(__name__)


def get_lead_knowledge_tool(
    db: Session,
    *,
    company_id: UUID,
    inquiry_text: str,
) -> CompanyKnowledgeContext:
    """Retrieve verified company offerings and relevant solution case studies for inquiry."""
    logger.info("Tool execute: get_lead_knowledge company=%s len=%d", company_id, len(inquiry_text))
    return get_lead_knowledge_context(
        db,
        company_id=company_id,
        inquiry_text=inquiry_text,
    )


def get_or_create_lead_tool(
    db: Session,
    *,
    company_id: UUID,
    lead_id: UUID | None = None,
    full_name: str | None = None,
    email: str | None = None,
    organization: str | None = None,
) -> DimLead:
    """Find an existing lead or create a new active DimLead record."""
    if lead_id:
        existing = db.get(DimLead, lead_id)
        if existing and existing.company_id == company_id:
            return existing

    if email:
        stmt = select(DimLead).where(
            DimLead.company_id == company_id,
            DimLead.email == email.strip().lower(),
        )
        found = db.scalars(stmt).first()
        if found:
            return found

    new_lead = DimLead(
        lead_id=lead_id or uuid4(),
        company_id=company_id,
        full_name=full_name.strip() if full_name else None,
        email=email.strip().lower() if email else None,
        organization=organization.strip() if organization else None,
        lead_status="active",
        created_at=datetime.now(timezone.utc),
    )
    db.add(new_lead)
    db.commit()
    logger.info("Created new lead: lead_id=%s company=%s", new_lead.lead_id, company_id)
    return new_lead


def _get_or_create_date_id(db: Session, target_date: date) -> int:
    """Ensure DimDate record exists for given date and return date_id integer."""
    date_id = target_date.year * 10000 + target_date.month * 100 + target_date.day
    existing = db.get(DimDate, date_id)
    if existing:
        return date_id

    dim_date = DimDate(
        date_id=date_id,
        full_date=target_date,
        day_of_week=target_date.strftime("%A"),
        day_of_month=target_date.day,
        month_number=target_date.month,
        month_name=target_date.strftime("%B"),
        quarter=(target_date.month - 1) // 3 + 1,
        year=target_date.year,
        is_weekend=target_date.weekday() >= 5,
    )
    db.add(dim_date)
    db.commit()
    return date_id


def save_lead_qualification_tool(
    db: Session,
    *,
    company_id: UUID,
    lead_id: UUID,
    source_id: UUID | None,
    lead_score: int,
    confidence_score: float,
    intent_level: str,
    qualification_status: str,
    recommended_action: str | None,
) -> UUID:
    """
    Persist lead evaluation results into fact_lead_qualification table.
    Enforces foreign keys to dim_lead and dim_date.
    """
    now = datetime.now(timezone.utc)
    date_id = _get_or_create_date_id(db, now.date())

    qual_id = uuid4()
    record = FactLeadQualification(
        qualification_id=qual_id,
        company_id=company_id,
        lead_id=lead_id,
        source_id=source_id,
        date_id=date_id,
        lead_score=lead_score,
        confidence_score=confidence_score,
        intent_level=intent_level,
        qualification_status=qualification_status,
        recommended_action=recommended_action,
        evaluated_at=now,
    )
    db.add(record)
    db.commit()

    logger.info(
        "Persisted lead qualification: qual_id=%s lead_id=%s score=%d status=%s",
        qual_id,
        lead_id,
        lead_score,
        qualification_status,
    )
    return qual_id
