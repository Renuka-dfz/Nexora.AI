"""
Nexora.AI - Marketing Agent Authorization & Permissions.

Enforces:
- Company boundary isolation.
- Draft creation and revision rights.
- Mandatory human approval before publishing.
- Server-side validation before scheduling or external API calls.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.marketing.models import DimContent, DimSocialAccount

logger = logging.getLogger(__name__)


class PermissionDeniedError(Exception):
    """Raised when an agent action violates company or role boundaries."""


def enforce_company_access(
    requested_company_id: UUID,
    authorized_company_id: UUID,
) -> None:
    """Ensure the user/agent is operating strictly within the authorized company boundary."""
    if requested_company_id != authorized_company_id:
        logger.warning(
            "Access Denied: Attempted cross-company access (%s vs %s)",
            requested_company_id,
            authorized_company_id,
        )
        raise PermissionDeniedError(
            f"Unauthorized access: company mismatch {requested_company_id}"
        )


def verify_content_approval_for_publish(
    db: Session,
    *,
    content_id: UUID,
    company_id: UUID,
) -> DimContent:
    """
    Enforce human approval requirement before publishing.
    Rejects any content not strictly marked as 'approved'.
    """
    record = db.get(DimContent, content_id)
    if record is None:
        raise PermissionDeniedError(f"Content record {content_id} not found.")

    if record.company_id != company_id:
        raise PermissionDeniedError(
            f"Content {content_id} does not belong to authorized company {company_id}."
        )

    if record.approval_status != "approved":
        logger.warning(
            "Publish blocked: content %s has status '%s' (must be 'approved')",
            content_id,
            record.approval_status,
        )
        raise PermissionDeniedError(
            f"Content {content_id} is '{record.approval_status}'. "
            "Explicit human approval is required before publishing."
        )

    return record


def verify_social_account_ownership(
    db: Session,
    *,
    social_account_id: UUID,
    company_id: UUID,
) -> DimSocialAccount:
    """Verify that the target publishing account belongs to the authorized company."""
    account = db.get(DimSocialAccount, social_account_id)
    if account is None or account.company_id != company_id:
        raise PermissionDeniedError(
            f"Social account {social_account_id} not authorized for company {company_id}."
        )

    if account.connection_status != "connected":
        raise PermissionDeniedError(
            f"Social account {social_account_id} is in status '{account.connection_status}'."
        )

    return account
