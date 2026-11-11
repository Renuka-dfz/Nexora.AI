
"""
Nexora.AI - Marketing CRUD Operations

Existing tables:
- dim_content
- dim_social_account
- dim_date
- fact_marketing_performance

Uses the shared dim_company table.

Scope:
SQLAlchemy CRUD only.
No campaigns, AI agents, APIs, or social publishing.
"""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.marketing.models import (
    DimContent,
    DimSocialAccount,
    DimDate,
    FactMarketingPerformance,
)


def utc_now():
    return datetime.now(timezone.utc)


def save_changes(db: Session, record):
    """Commit changes and refresh the record."""
    try:
        db.commit()
        db.refresh(record)
        return record
    except Exception:
        db.rollback()
        raise


# ======================================================
# 1. CONTENT CRUD
# ======================================================

def create_content(
    db: Session,
    company_id: uuid.UUID,
    content_title: str,
    content_type: str,
    platform_target: str,
    content_text: str,
    topic: str | None = None,
    tone: str | None = None,
    generation_type: str = "ai",
):
    """CREATE: Save AI-generated or manual content."""

    if generation_type not in {"ai", "manual"}:
        raise ValueError("Invalid generation type")

    content = DimContent(
        company_id=company_id,
        content_title=content_title,
        content_type=content_type,
        platform_target=platform_target,
        content_text=content_text,
        topic=topic,
        tone=tone,
        generation_type=generation_type,
        approval_status="draft",
    )

    db.add(content)
    return save_changes(db, content)


def get_content(
    db: Session,
    company_id: uuid.UUID,
    content_id: uuid.UUID,
):
    """READ: Retrieve one company content item."""

    return db.scalar(
        select(DimContent).where(
            DimContent.company_id == company_id,
            DimContent.content_id == content_id,
        )
    )


def list_content(
    db: Session,
    company_id: uuid.UUID,
    approval_status: str | None = None,
    platform_target: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """READ: List company content with filters."""

    stmt = select(DimContent).where(
        DimContent.company_id == company_id
    )

    if approval_status:
        stmt = stmt.where(
            DimContent.approval_status == approval_status
        )

    if platform_target:
        stmt = stmt.where(
            DimContent.platform_target == platform_target
        )

    stmt = (
        stmt.order_by(DimContent.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .offset(max(0, offset))
    )

    return db.scalars(stmt).all()


def update_content(
    db: Session,
    company_id: uuid.UUID,
    content_id: uuid.UUID,
    **updates,
):
    """UPDATE: Edit an existing content draft."""

    content = get_content(db, company_id, content_id)

    if content is None:
        return None

    # Published or approved content should not be
    # modified without a versioning workflow.
    if content.approval_status == "approved":
        raise ValueError(
            "Approved content cannot be edited directly"
        )

    allowed_fields = {
        "content_title",
        "content_type",
        "platform_target",
        "content_text",
        "topic",
        "tone",
    }

    for field, value in updates.items():
        if field not in allowed_fields:
            raise ValueError(
                f"Invalid content field: {field}"
            )

        if field in {
            "content_title",
            "content_type",
            "platform_target",
            "content_text",
        } and (not isinstance(value, str) or not value.strip()):
            raise ValueError(f"{field} cannot be empty")

    for field, value in updates.items():
        setattr(content, field, value)

    if updates:
        content.approval_status = "draft"

    return save_changes(db, content)


def update_content_approval(
    db: Session,
    company_id: uuid.UUID,
    content_id: uuid.UUID,
    approval_status: str,
):
    """
    UPDATE: Change content approval status.

    IMPORTANT:
    This function assumes authorization has
    already been enforced by the calling service.

    Production approval must also capture
    reviewer identity and approval history.
    """

    allowed = {
        "draft",
        "pending",
        "approved",
        "rejected",
    }

    if approval_status not in allowed:
        raise ValueError("Invalid approval status")

    content = get_content(db, company_id, content_id)

    if content is None:
        return None

    content.approval_status = approval_status

    return save_changes(db, content)


def delete_content(
    db: Session,
    company_id: uuid.UUID,
    content_id: uuid.UUID,
):
    """DELETE: Remove an unused content draft."""

    content = get_content(db, company_id, content_id)

    if content is None:
        return False

    if content.approval_status == "approved":
        raise ValueError(
            "Approved content should not be deleted directly"
        )

    try:
        db.delete(content)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


# ======================================================
# 2. SOCIAL ACCOUNT CRUD
# ======================================================

def create_social_account(
    db: Session,
    company_id: uuid.UUID,
    platform: str,
    external_account_id: str,
    account_name: str | None = None,
    account_handle: str | None = None,
    account_type: str | None = None,
):
    """CREATE: Register a social media account."""

    platform = platform.lower()

    if platform not in {"linkedin", "instagram"}:
        raise ValueError("Unsupported platform")

    existing = db.scalar(
        select(DimSocialAccount).where(
            DimSocialAccount.company_id == company_id,
            DimSocialAccount.platform == platform,
            DimSocialAccount.external_account_id
            == external_account_id,
        )
    )

    if existing is not None:
        return existing

    account = DimSocialAccount(
        company_id=company_id,
        platform=platform,
        external_account_id=external_account_id,
        account_name=account_name,
        account_handle=account_handle,
        account_type=account_type,
        connection_status="disconnected",
    )

    db.add(account)
    return save_changes(db, account)


def get_social_account(
    db: Session,
    company_id: uuid.UUID,
    social_account_id: uuid.UUID,
):
    """READ: Retrieve one social account."""

    return db.scalar(
        select(DimSocialAccount).where(
            DimSocialAccount.company_id == company_id,
            DimSocialAccount.social_account_id
            == social_account_id,
        )
    )


def list_social_accounts(
    db: Session,
    company_id: uuid.UUID,
):
    """READ: List connected account records."""

    stmt = (
        select(DimSocialAccount)
        .where(DimSocialAccount.company_id == company_id)
        .order_by(DimSocialAccount.platform)
    )

    return db.scalars(stmt).all()


def update_social_account(
    db: Session,
    company_id: uuid.UUID,
    social_account_id: uuid.UUID,
    **updates,
):
    """UPDATE: Modify social account information."""

    account = get_social_account(
        db, company_id, social_account_id
    )

    if account is None:
        return None

    allowed_fields = {
        "account_name",
        "account_handle",
        "account_type",
    }

    for field, value in updates.items():
        if field not in allowed_fields:
            raise ValueError(
                f"Invalid social account field: {field}"
            )

        setattr(account, field, value)

    return save_changes(db, account)


def update_connection_status(
    db: Session,
    company_id: uuid.UUID,
    social_account_id: uuid.UUID,
    connection_status: str,
):
    """
    UPDATE: Record an integration connection state.

    Only a trusted integration service should
    call this after verifying the OAuth state.
    """

    allowed = {
        "connected",
        "disconnected",
        "expired",
    }

    if connection_status not in allowed:
        raise ValueError("Invalid connection status")

    account = get_social_account(
        db, company_id, social_account_id
    )

    if account is None:
        return None

    account.connection_status = connection_status

    if connection_status == "connected":
        account.connected_at = utc_now()

    return save_changes(db, account)


def delete_social_account(
    db: Session,
    company_id: uuid.UUID,
    social_account_id: uuid.UUID,
):
    """DELETE: Remove an unused social account."""

    account = get_social_account(
        db, company_id, social_account_id
    )

    if account is None:
        return False

    try:
        db.delete(account)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


# ======================================================
# 3. DATE DIMENSION CRUD
# ======================================================

def get_date(
    db: Session,
    date_id: int,
):
    """READ: Retrieve a reporting date."""
    return db.get(DimDate, date_id)


def get_or_create_date(
    db: Session,
    reporting_date: date,
):
    """CREATE/READ: Reuse or create a date dimension."""

    date_id = int(reporting_date.strftime("%Y%m%d"))

    existing = get_date(db, date_id)

    if existing is not None:
        return existing

    new_date = DimDate(
        date_id=date_id,
        full_date=reporting_date,
        day_of_week=reporting_date.strftime("%A"),
        day_of_month=reporting_date.day,
        month_number=reporting_date.month,
        month_name=reporting_date.strftime("%B"),
        quarter=(reporting_date.month - 1) // 3 + 1,
        year=reporting_date.year,
        is_weekend=reporting_date.weekday() >= 5,
    )

    db.add(new_date)
    return save_changes(db, new_date)


# ======================================================
# 4. MARKETING PERFORMANCE CRUD
# ======================================================

METRIC_FIELDS = {
    "impressions",
    "reach",
    "likes",
    "comments",
    "shares",
    "saves",
    "clicks",
    "video_views",
}


def validate_metrics(metrics: dict):
    """Validate non-negative performance counts."""

    unknown = set(metrics) - METRIC_FIELDS

    if unknown:
        raise ValueError(
            f"Unsupported metrics: {sorted(unknown)}"
        )

    for name, value in metrics.items():
        if value is not None:
            if type(value) is not int or value < 0:
                raise ValueError(
                    f"{name} must be a non-negative integer"
                )


def create_marketing_performance(
    db: Session,
    company_id: uuid.UUID,
    content_id: uuid.UUID,
    social_account_id: uuid.UUID,
    published_post_id: uuid.UUID,
    collected_at: datetime,
    metric_period: str = "lifetime",
    metric_source: str | None = None,
    **metrics,
):
    """
    CREATE: Save a performance snapshot.

    Grain:
    One published post + reporting period
    + collection timestamp.

    The published_post_id is an internal UUID
    referring to a publication record.
    """

    if collected_at.tzinfo is None:
        raise ValueError(
            "collected_at must include a timezone"
        )

    if metric_period not in {"daily", "lifetime"}:
        raise ValueError("Invalid metric period")

    validate_metrics(metrics)

    content = get_content(db, company_id, content_id)
    account = get_social_account(
        db, company_id, social_account_id
    )

    if content is None or account is None:
        raise ValueError(
            "Content or social account not found "
            "for this company"
        )

    reporting_date = collected_at.astimezone(
        timezone.utc
    ).date()

    date_id = int(reporting_date.strftime("%Y%m%d"))

    # Check duplicate snapshot.
    existing = db.scalar(
        select(FactMarketingPerformance).where(
            FactMarketingPerformance.published_post_id
            == published_post_id,
            FactMarketingPerformance.metric_period
            == metric_period,
            FactMarketingPerformance.collected_at
            == collected_at,
        )
    )

    if existing is not None:
        raise ValueError(
            "This performance snapshot already exists"
        )

    try:
        reporting_dim = db.get(DimDate, date_id)

        if reporting_dim is None:
            reporting_dim = DimDate(
                date_id=date_id,
                full_date=reporting_date,
                day_of_week=reporting_date.strftime("%A"),
                day_of_month=reporting_date.day,
                month_number=reporting_date.month,
                month_name=reporting_date.strftime("%B"),
                quarter=(reporting_date.month - 1) // 3 + 1,
                year=reporting_date.year,
                is_weekend=reporting_date.weekday() >= 5,
            )
            db.add(reporting_dim)
            db.flush()

        performance = FactMarketingPerformance(
            company_id=company_id,
            content_id=content_id,
            social_account_id=social_account_id,
            published_post_id=published_post_id,
            date_id=date_id,
            collected_at=collected_at,
            metric_period=metric_period,
            metric_source=metric_source,
            retrieval_status="success",
            **metrics,
        )

        db.add(performance)
        db.commit()
        db.refresh(performance)

        return performance

    except Exception:
        db.rollback()
        raise


def get_marketing_performance(
    db: Session,
    company_id: uuid.UUID,
    performance_id: uuid.UUID,
):
    """READ: Retrieve one performance snapshot."""

    return db.scalar(
        select(FactMarketingPerformance).where(
            FactMarketingPerformance.company_id
            == company_id,
            FactMarketingPerformance.performance_id
            == performance_id,
        )
    )


def list_marketing_performance(
    db: Session,
    company_id: uuid.UUID,
    content_id: uuid.UUID | None = None,
    social_account_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """READ: List company performance snapshots."""

    stmt = select(FactMarketingPerformance).where(
        FactMarketingPerformance.company_id == company_id
    )

    if content_id is not None:
        stmt = stmt.where(
            FactMarketingPerformance.content_id == content_id
        )

    if social_account_id is not None:
        stmt = stmt.where(
            FactMarketingPerformance.social_account_id
            == social_account_id
        )

    stmt = (
        stmt.order_by(
            FactMarketingPerformance.collected_at.desc()
        )
        .limit(max(1, min(limit, 100)))
        .offset(max(0, offset))
    )

    return db.scalars(stmt).all()


def get_latest_post_performance(
    db: Session,
    company_id: uuid.UUID,
    published_post_id: uuid.UUID,
    metric_period: str = "lifetime",
):
    """
    READ: Retrieve the latest snapshot for a post.

    Useful because cumulative snapshots must
    not be summed across collection dates.
    """

    stmt = (
        select(FactMarketingPerformance)
        .where(
            FactMarketingPerformance.company_id
            == company_id,

            FactMarketingPerformance.published_post_id
            == published_post_id,

            FactMarketingPerformance.metric_period
            == metric_period,
        )
        .order_by(
            FactMarketingPerformance.collected_at.desc()
        )
        .limit(1)
    )

    return db.scalar(stmt)


def update_marketing_performance(
    db: Session,
    company_id: uuid.UUID,
    performance_id: uuid.UUID,
    **metrics,
):
    """
    UPDATE: Correct metric values in a snapshot.

    New API collections should normally create
    a new snapshot instead of replacing history.
    """

    performance = get_marketing_performance(
        db, company_id, performance_id
    )

    if performance is None:
        return None

    validate_metrics(metrics)

    for field, value in metrics.items():
        setattr(performance, field, value)

    return save_changes(db, performance)


def delete_marketing_performance(
    db: Session,
    company_id: uuid.UUID,
    performance_id: uuid.UUID,
):
    """
    DELETE: Remove an invalid performance record.

    Production use should restrict this to
    authorized administrative corrections.
    """

    performance = get_marketing_performance(
        db, company_id, performance_id
    )

    if performance is None:
        return False

    try:
        db.delete(performance)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
