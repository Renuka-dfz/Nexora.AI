"""Company Intelligence Star Schema models for Nexora.AI.

Defines the database tables, columns, constraints, and relationships for:
- DIM_COMPANY: Dimension table storing company profiles
- DIM_CATEGORY: Dimension table storing intelligence categories
- DIM_SOURCE: Dimension table storing sources of extracted information
- FACT_COMPANY_INTELLIGENCE: Fact table storing extracted company intelligence
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Reuse existing declarative Base if available, otherwise define Base
try:
    from app.core.database import Base
except (ImportError, AttributeError):
    class Base(DeclarativeBase):
        pass


class DimCompany(Base):
    """Stores company profile information."""

    __tablename__ = "dim_company"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    company_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
    )
    website_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    company_overview: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    industry: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    headquarters: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    sources: Mapped[List["DimSource"]] = relationship(
        "DimSource",
        back_populates="company",
        cascade="all, delete-orphan",
    )
    facts: Mapped[List["FactCompanyIntelligence"]] = relationship(
        "FactCompanyIntelligence",
        back_populates="company",
        cascade="all, delete-orphan",
    )


class DimCategory(Base):
    """Stores Company Intelligence categories.

    Supported categories:
    1. Company Overview
    2. Services
    3. Products
    4. Technology Stack
    5. Projects
    6. Innovations and Research
    7. Brand Identities
    8. Knowledge Resources
    9. Case Studies
    10. Achievements
    11. Industry Expertise
    12. Customers
    """

    __tablename__ = "dim_category"

    category_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    category_name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )

    # Relationships
    facts: Mapped[List["FactCompanyIntelligence"]] = relationship(
        "FactCompanyIntelligence",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class DimSource(Base):
    """Stores the source of extracted information."""

    __tablename__ = "dim_source"
    __table_args__ = (
        UniqueConstraint(
            "source_id",
            "company_id",
            name="uq_dim_source_company",
        ),
    )

    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dim_company.company_id", ondelete="CASCADE"),
        nullable=False,
    )
    source_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    source_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )
    page_title: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    last_crawled_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )

    # Relationships
    company: Mapped["DimCompany"] = relationship(
        "DimCompany",
        back_populates="sources",
    )
    facts: Mapped[List["FactCompanyIntelligence"]] = relationship(
        "FactCompanyIntelligence",
        back_populates="source",
        cascade="all, delete-orphan",
        overlaps="facts,company",
    )


class FactCompanyIntelligence(Base):
    """Stores actual company information extracted from websites."""

    __tablename__ = "fact_company_intelligence"
    __table_args__ = (
        ForeignKeyConstraint(
            ["source_id", "company_id"],
            ["dim_source.source_id", "dim_source.company_id"],
            name="fk_fact_intelligence_source_company",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "verification_status IN ('pending', 'verified', 'rejected', 'conflicting')",
            name="ck_fact_intelligence_verification_status",
        ),
    )

    fact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dim_company.company_id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("dim_category.category_id", ondelete="CASCADE"),
        nullable=False,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    verification_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )
    extracted_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    company: Mapped["DimCompany"] = relationship(
        "DimCompany",
        back_populates="facts",
        foreign_keys=[company_id],
    )
    category: Mapped["DimCategory"] = relationship(
        "DimCategory",
        back_populates="facts",
        foreign_keys=[category_id],
    )
    source: Mapped["DimSource"] = relationship(
        "DimSource",
        back_populates="facts",
        foreign_keys=[source_id, company_id],
        overlaps="facts,company",
    )

