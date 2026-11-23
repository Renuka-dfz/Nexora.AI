"""
Nexora.AI - Lead Qualification Agent Authorization & Permissions.

Enforces strict company-scoped access for leads, qualification records,
and outbound recommendation updates.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.lead_management.models import DimLead

logger = logging.getLogger(__name__)


class LeadPermissionError(Exception):
    """Raised when an operation on a lead record violates access controls."""


def verify_lead_company_access(
    db: Session,
    *,
    lead_id: UUID,
    company_id: UUID,
) -> DimLead:
    """Verify that a lead belongs strictly to the authorized company."""
    lead = db.get(DimLead, lead_id)
    if lead is None:
        raise LeadPermissionError(f"Lead record {lead_id} not found.")

    if lead.company_id != company_id:
        logger.warning(
            "Access Denied: Lead %s belongs to company %s, not %s",
            lead_id,
            lead.company_id,
            company_id,
        )
        raise LeadPermissionError(
            f"Unauthorized: lead {lead_id} does not belong to company {company_id}."
        )

    return lead
