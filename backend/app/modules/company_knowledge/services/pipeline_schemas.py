from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ExtractedSection(BaseModel):
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
    metadata: dict[str, Any] = Field(default_factory=dict)
    crawl_status: Literal["success", "failed", "skipped"] = "success"
    error_message: str | None = None
    sections: list[ExtractedSection] = Field(default_factory=list)


class CrawlPipelineOutput(BaseModel):
    pages: list[ExtractedPage]
