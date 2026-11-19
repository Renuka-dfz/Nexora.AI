"""Pydantic schemas for the Nexora.AI marketing-focused intelligence pipeline.

Supports structured business candidates, marketing relevance filtering, and
end-to-end telemetry through CrawlQualityReport.
"""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CrawlQualityReport(BaseModel):
    """Telemetry report capturing every stage of the ingestion pipeline."""
    pages_crawled: int = 0
    business_candidates_extracted: int = 0
    marketing_relevant_candidates: int = 0
    marketing_irrelevant_candidates: int = 0
    pending_review_candidates: int = 0
    verified_candidates: int = 0
    rejected_candidates: int = 0
    duplicate_candidates: int = 0
    boilerplate_blocks_removed: int = 0
    source_verification_failures: int = 0
    classification_conflicts: int = 0
    trusted_records_persisted: int = 0
    rag_indexed_records: int = 0
    staged_records_persisted: int = 0


class MarketingIntelligenceCandidate(BaseModel):
    """Structured candidate representing an extracted business entity for marketing."""
    company_id: UUID | None = None
    source_url: str
    page_type: str = "unknown"
    entity_type: str = "general"
    entity_name: str | None = None
    heading_path: list[str] = Field(default_factory=list)
    content: str
    proposed_category: str | None = None
    marketing_relevance: Literal["relevant", "uncertain", "irrelevant"] = "relevant"
    relevance_reason: str | None = None
    evidence_text: str | None = None
    confidence: float | None = 0.8
    verification_status: Literal["verified", "approved", "pending_review", "rejected"] = "pending_review"


class ExtractedSection(BaseModel):
    """Backward-compatible section model representing an intelligence candidate."""
    category: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    source_url: str = Field(min_length=1)
    heading_path: str = Field(default="", max_length=2000)
    section_order: int = Field(ge=0)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("category", "title", "content", "source_url")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value cannot be blank")
        return value


class ExtractedPage(BaseModel):
    page_url: str = Field(min_length=1)
    title: str | None = Field(default=None, max_length=500)
    meta_description: str | None = None
    raw_html: str | None = None
    markdown_content: str | None = None
    page_type: str = "unknown"
    metadata: dict[str, Any] = Field(default_factory=dict)
    crawl_status: Literal["success", "failed", "skipped"] = "success"
    error_message: str | None = None
    sections: list[ExtractedSection] = Field(default_factory=list)


class CrawlPipelineOutput(BaseModel):
    pages: list[ExtractedPage]
    quality_report: CrawlQualityReport | None = None
