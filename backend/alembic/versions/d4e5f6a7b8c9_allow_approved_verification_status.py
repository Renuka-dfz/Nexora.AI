"""Allow approved company intelligence facts.

Revision ID: d4e5f6a7b8c9
Revises: c7186ca402e1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c7186ca402e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_VERIFICATION_CHECK = (
    "verification_status IN "
    "('pending', 'verified', 'rejected', 'conflicting')"
)
NEW_VERIFICATION_CHECK = (
    "verification_status IN "
    "('pending', 'verified', 'approved', 'rejected', 'conflicting')"
)


def upgrade() -> None:
    op.drop_constraint(
        "ck_fact_intelligence_verification_status",
        "fact_company_intelligence",
        type_="check",
    )
    op.create_check_constraint(
        "ck_fact_intelligence_verification_status",
        "fact_company_intelligence",
        NEW_VERIFICATION_CHECK,
    )


def downgrade() -> None:
    approved_exists = op.get_bind().execute(
        sa.text(
            "SELECT EXISTS ("
            "SELECT 1 FROM fact_company_intelligence "
            "WHERE verification_status = 'approved'"
            ")"
        )
    ).scalar_one()
    if approved_exists:
        raise RuntimeError(
            "Cannot remove the approved verification status while "
            "approved company intelligence records exist."
        )

    op.drop_constraint(
        "ck_fact_intelligence_verification_status",
        "fact_company_intelligence",
        type_="check",
    )
    op.create_check_constraint(
        "ck_fact_intelligence_verification_status",
        "fact_company_intelligence",
        OLD_VERIFICATION_CHECK,
    )