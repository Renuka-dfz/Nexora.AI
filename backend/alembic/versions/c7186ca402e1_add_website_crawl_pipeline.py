"""Add persistent website crawl pipeline records.

Revision ID: c7186ca402e1
Revises: rbac_user_roles_v1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7186ca402e1"
down_revision: Union[str, Sequence[str], None] = "rbac_user_roles_v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EXTRA_CATEGORIES = (
    "Contact Information",
    "Pricing",
    "Solutions",
    "Careers",
)


def upgrade() -> None:
    connection = op.get_bind()
    duplicate_source = connection.execute(
        sa.text(
            """
            SELECT company_id, source_url
            FROM dim_source
            GROUP BY company_id, source_url
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).first()
    if duplicate_source is not None:
        raise RuntimeError(
            "Cannot add website source uniqueness: duplicate source URLs "
            "exist for a company. Resolve those duplicates and retry."
        )

    op.create_unique_constraint(
        "uq_dim_source_company_url",
        "dim_source",
        ["company_id", "source_url"],
    )

    op.create_table(
        "website_crawl_job",
        sa.Column("job_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("requested_by", sa.UUID(), nullable=False),
        sa.Column("website_url", sa.Text(), nullable=False),
        sa.Column("sitemap_urls", sa.JSON(), nullable=False),
        sa.Column(
            "sitemap_available",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default=sa.text("'queued'"),
            nullable=False,
        ),
        sa.Column(
            "pages_discovered",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "pages_processed",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "sections_saved",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="ck_website_crawl_job_status",
        ),
        sa.CheckConstraint(
            "pages_discovered >= 0 AND pages_processed >= 0 AND sections_saved >= 0",
            name="ck_website_crawl_job_counts",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["dim_company.company_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["requested_by"],
            ["app_user.user_id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_id", "company_id"],
            ["dim_source.source_id", "dim_source.company_id"],
            name="fk_website_crawl_job_source_company",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("job_id"),
        sa.UniqueConstraint(
            "job_id",
            "company_id",
            name="uq_website_crawl_job_company",
        ),
    )
    op.create_index(
        "ix_website_crawl_job_company_id",
        "website_crawl_job",
        ["company_id"],
    )

    op.create_table(
        "crawled_page",
        sa.Column("page_id", sa.UUID(), nullable=False),
        sa.Column("company_id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("last_job_id", sa.UUID(), nullable=False),
        sa.Column("page_url", sa.Text(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("meta_description", sa.Text(), nullable=True),
        sa.Column("raw_html", sa.Text(), nullable=True),
        sa.Column("markdown_content", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column(
            "crawl_status",
            sa.String(length=20),
            server_default=sa.text("'success'"),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "crawled_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "crawl_status IN ('success', 'failed', 'skipped')",
            name="ck_crawled_page_status",
        ),
        sa.ForeignKeyConstraint(
            ["company_id"],
            ["dim_company.company_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_id", "company_id"],
            ["dim_source.source_id", "dim_source.company_id"],
            name="fk_crawled_page_source_company",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["last_job_id", "company_id"],
            ["website_crawl_job.job_id", "website_crawl_job.company_id"],
            name="fk_crawled_page_job_company",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("page_id"),
        sa.UniqueConstraint(
            "page_id",
            "company_id",
            name="uq_crawled_page_company",
        ),
        sa.UniqueConstraint(
            "company_id",
            "page_url",
            name="uq_crawled_page_company_url",
        ),
    )
    op.create_index(
        "ix_crawled_page_company_id",
        "crawled_page",
        ["company_id"],
    )

    op.add_column(
        "fact_company_intelligence",
        sa.Column("page_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "fact_company_intelligence",
        sa.Column("heading_path", sa.Text(), nullable=True),
    )
    op.add_column(
        "fact_company_intelligence",
        sa.Column("section_order", sa.Integer(), nullable=True),
    )
    op.add_column(
        "fact_company_intelligence",
        sa.Column("section_key", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "fact_company_intelligence",
        sa.Column(
            "is_current",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.create_foreign_key(
        "fk_fact_intelligence_page_company",
        "fact_company_intelligence",
        "crawled_page",
        ["page_id", "company_id"],
        ["page_id", "company_id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_fact_intelligence_page_section",
        "fact_company_intelligence",
        ["page_id", "section_key"],
    )

    category_values = ", ".join(f"('{name}')" for name in EXTRA_CATEGORIES)
    op.execute(
        sa.text(
            "INSERT INTO dim_category (category_name) VALUES "
            f"{category_values} ON CONFLICT (category_name) DO NOTHING"
        )
    )


def downgrade() -> None:
    names = ", ".join(f"'{name}'" for name in EXTRA_CATEGORIES)
    op.execute(
        sa.text(
            "DELETE FROM dim_category "
            f"WHERE category_name IN ({names}) "
            "AND NOT EXISTS ("
            "SELECT 1 FROM fact_company_intelligence "
            "WHERE fact_company_intelligence.category_id = dim_category.category_id"
            ")"
        )
    )

    op.drop_constraint(
        "uq_fact_intelligence_page_section",
        "fact_company_intelligence",
        type_="unique",
    )
    op.drop_constraint(
        "fk_fact_intelligence_page_company",
        "fact_company_intelligence",
        type_="foreignkey",
    )
    op.drop_column("fact_company_intelligence", "is_current")
    op.drop_column("fact_company_intelligence", "section_key")
    op.drop_column("fact_company_intelligence", "section_order")
    op.drop_column("fact_company_intelligence", "heading_path")
    op.drop_column("fact_company_intelligence", "page_id")

    op.drop_index("ix_crawled_page_company_id", table_name="crawled_page")
    op.drop_table("crawled_page")
    op.drop_index(
        "ix_website_crawl_job_company_id",
        table_name="website_crawl_job",
    )
    op.drop_table("website_crawl_job")
    op.drop_constraint(
        "uq_dim_source_company_url",
        "dim_source",
        type_="unique",
    )
