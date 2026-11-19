"""Company Intelligence Star Schema models for Nexora.AI.

Defines the database tables, columns, constraints, and relationships for:
- DIM_COMPANY: Dimension table storing company profiles
- DIM_CATEGORY: Dimension table storing intelligence categories
- DIM_SOURCE: Dimension table storing sources of extracted information
- FACT_COMPANY_INTELLIGENCE: Fact table storing extracted company intelligence
"""

import uuid
from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    JSON,
    String,
    Text,
    TIMESTAMP,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.core.database import Base


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
        UniqueConstraint(
            "company_id",
            "source_url",
            name="uq_dim_source_company_url",
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


class WebsiteCrawlJob(Base):
    __tablename__ = "website_crawl_job"
    __table_args__ = (
        UniqueConstraint(
            "job_id",
            "company_id",
            name="uq_website_crawl_job_company",
        ),
        ForeignKeyConstraint(
            ["source_id", "company_id"],
            ["dim_source.source_id", "dim_source.company_id"],
            name="fk_website_crawl_job_source_company",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="ck_website_crawl_job_status",
        ),
        CheckConstraint(
            "pages_discovered >= 0 AND pages_processed >= 0 "
            "AND sections_saved >= 0",
            name="ck_website_crawl_job_counts",
        ),
    )

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dim_company.company_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app_user.user_id", ondelete="RESTRICT"),
        nullable=False,
    )
    website_url: Mapped[str] = mapped_column(Text, nullable=False)
    sitemap_urls: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )
    sitemap_available: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",
        server_default=text("'queued'"),
    )
    pages_discovered: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    pages_processed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    sections_saved: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    error_code: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=True,
    )


class CrawledPage(Base):
    __tablename__ = "crawled_page"
    __table_args__ = (
        UniqueConstraint(
            "page_id",
            "company_id",
            name="uq_crawled_page_company",
        ),
        UniqueConstraint(
            "company_id",
            "page_url",
            name="uq_crawled_page_company_url",
        ),
        ForeignKeyConstraint(
            ["source_id", "company_id"],
            ["dim_source.source_id", "dim_source.company_id"],
            name="fk_crawled_page_source_company",
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["last_job_id", "company_id"],
            ["website_crawl_job.job_id", "website_crawl_job.company_id"],
            name="fk_crawled_page_job_company",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "crawl_status IN ('success', 'failed', 'skipped')",
            name="ck_crawled_page_status",
        ),
    )

    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dim_company.company_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    last_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    page_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    markdown_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
    )
    content_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    crawl_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="success",
        server_default=text("'success'"),
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    crawled_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
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
            "verification_status IN "
            "('pending', 'verified', 'approved', 'rejected', 'conflicting')",
            name="ck_fact_intelligence_verification_status",
        ),
        ForeignKeyConstraint(
            ["page_id", "company_id"],
            ["crawled_page.page_id", "crawled_page.company_id"],
            name="fk_fact_intelligence_page_company",
            ondelete="CASCADE",
        ),
        UniqueConstraint(
            "page_id",
            "section_key",
            name="uq_fact_intelligence_page_section",
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
    page_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    heading_path: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    section_order: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    section_key: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
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

    # Synonym for fact_id for RAG indexing compatibility
    intelligence_id = synonym("fact_id")

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

