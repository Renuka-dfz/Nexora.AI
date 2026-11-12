"""Seed the company knowledge category dimension."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4f6c2d819b1"
down_revision: Union[str, Sequence[str], None] = "31c73db59e5d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORY_NAMES = (
    "Company Overview",
    "Services",
    "Products",
    "Technology Stack",
    "Projects",
    "Innovations and Research",
    "Brand Identities",
    "Knowledge Resources",
    "Case Studies",
    "Achievements",
    "Industry Expertise",
    "Customers",
)


def upgrade() -> None:
    values = ", ".join(f"('{name}')" for name in CATEGORY_NAMES)
    op.execute(
        sa.text(
            "INSERT INTO dim_category (category_name) VALUES "
            f"{values} ON CONFLICT (category_name) DO NOTHING"
        )
    )


def downgrade() -> None:
    names = ", ".join(f"'{name}'" for name in CATEGORY_NAMES)
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
