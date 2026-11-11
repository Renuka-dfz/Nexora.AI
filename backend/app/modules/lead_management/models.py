
"""
Nexora.AI - Lead Qualification Star Schema

Shared Dimensions:
1. DIM_COMPANY - Existing Company Intelligence dimension
2. DIM_DATE    - Existing Marketing dimension

New Dimensions:
3. DIM_LEAD
4. DIM_LEAD_SOURCE

Fact:
5. FACT_LEAD_QUALIFICATION

No Campaign Management required.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


# ============================================================
# DIMENSION 1: COMPANY (EXISTING)
# ============================================================

# Reuse dim_company from Company Intelligence.
# Do not create another Company table.


# ============================================================
# DIMENSION 2: LEAD
# ============================================================

class DimLead(Base):
    """
    Stores information about a potential customer.

    Example:
        Name: Rahul Sharma
        Organization: ABC Technologies
        Job Title: IT Manager
        Status: active
    """

    __tablename__ = "dim_lead"

    __table_args__ = (
        UniqueConstraint(
            "lead_id",
            "company_id",
            name="uq_lead_company",
        ),
        CheckConstraint(
            "lead_status IN ('active', 'inactive', 'converted')",
            name="ck_lead_status",
        ),
    )

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "dim_company.company_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    full_name: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )

    email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    phone: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )

    organization_name: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )

    job_title: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )

    industry: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )

    lead_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'active'"),
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


# ============================================================
# DIMENSION 3: LEAD SOURCE
# ============================================================

class DimLeadSource(Base):
    """
    Identifies where the lead originated.

    Examples:
        Website inquiry
        LinkedIn
        Instagram
        Referral
        Manual entry
    """

    __tablename__ = "dim_lead_source"

    __table_args__ = (
        UniqueConstraint(
            "source_id",
            "company_id",
            name="uq_lead_source_company",
        ),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "dim_company.company_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    source_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    source_reference: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


# ============================================================
# DIMENSION 4: DATE (EXISTING)
# ============================================================

# Reuse dim_date from Marketing.
# Do not create another Date dimension.


# ============================================================
# FACT TABLE: LEAD QUALIFICATION
# ============================================================

class FactLeadQualification(Base):
    """
    Stores the results of evaluating a lead.

    Fact grain:
        One lead + one evaluation timestamp.

    Example:
        Lead Score: 85
        Intent Level: high
        Qualification Status: qualified
        Recommended Action: Schedule a sales call

    A lead can have multiple evaluation records over time.
    """

    __tablename__ = "fact_lead_qualification"

    __table_args__ = (

        # Ensure lead belongs to the same company.
        ForeignKeyConstraint(
            ["lead_id", "company_id"],
            ["dim_lead.lead_id", "dim_lead.company_id"],
            name="fk_qualification_lead_company",
            ondelete="RESTRICT",
        ),

        # Ensure source belongs to the same company.
        ForeignKeyConstraint(
            ["source_id", "company_id"],
            [
                "dim_lead_source.source_id",
                "dim_lead_source.company_id",
            ],
            name="fk_qualification_source_company",
            ondelete="RESTRICT",
        ),

        # Prevent duplicate evaluations at the same timestamp.
        UniqueConstraint(
            "lead_id",
            "evaluated_at",
            name="uq_lead_qualification_evaluation",
        ),

        # Lead score must be between 0 and 100.
        CheckConstraint(
            "lead_score BETWEEN 0 AND 100",
            name="ck_lead_qualification_score",
        ),

        # Confidence must be between 0 and 1.
        CheckConstraint(
            "confidence_score BETWEEN 0 AND 1",
            name="ck_lead_qualification_confidence",
        ),

        CheckConstraint(
            "intent_level IN ('unknown', 'low', 'medium', 'high')",
            name="ck_lead_qualification_intent",
        ),

        CheckConstraint(
            "qualification_status IN "
            "('pending', 'qualified', 'nurture', 'unqualified')",
            name="ck_lead_qualification_status",
        ),

        Index(
            "ix_lead_qualification_company_date",
            "company_id",
            "date_id",
        ),

        Index(
            "ix_lead_qualification_lead",
            "lead_id",
        ),

        Index(
            "ix_lead_qualification_score",
            "lead_score",
        ),
    )

    qualification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "dim_company.company_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )

    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    date_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey(
            "dim_date.date_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    lead_score: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )

    confidence_score: Mapped[Optional[float]] = mapped_column(
        nullable=True,
    )

    intent_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default=text("'unknown'"),
    )

    qualification_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        server_default=text("'pending'"),
    )

    qualification_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    recommended_action: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    scoring_version: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )

    evaluated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
