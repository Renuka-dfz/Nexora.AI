
"""
Nexora.AI - RBAC User Roles Migration

Migration:
    app_user + company_membership
                |
                v
    app_user (company_id, role)

Supported roles:
    admin
    user
    reviewer

Safety:
- Preserve existing users
- Preserve password hashes
- Preserve company associations
- Convert owner to admin
- Reject ambiguous multiple memberships
- Reject unsupported existing roles
- Execute in a PostgreSQL transaction

IMPORTANT:
Replace down_revision with your current Alembic head.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# =====================================================
# ALEMBIC REVISION IDENTIFIERS
# =====================================================

revision: str = "rbac_user_roles_v1"

# REPLACE with the revision shown by:
# python -m alembic heads

down_revision: Union[str, None] = (
    "ee817c5523a1"
)

branch_labels: Union[
    str, Sequence[str], None
] = None

depends_on: Union[
    str, Sequence[str], None
] = None


# =====================================================
# UPGRADE
# =====================================================

def upgrade() -> None:

    connection = op.get_bind()

    # -------------------------------------------------
    # 1. VERIFY EXISTING TABLES
    # -------------------------------------------------

    inspector = sa.inspect(connection)

    existing_tables = set(
        inspector.get_table_names()
    )

    required_tables = {
        "app_user",
        "company_membership",
        "dim_company",
    }

    missing_tables = (
        required_tables - existing_tables
    )

    if missing_tables:
        raise RuntimeError(
            "Required tables are missing: "
            f"{sorted(missing_tables)}"
        )

    # This migration expects the original
    # identity structure, not a partial migration.
    existing_user_columns = {
        column["name"]
        for column in inspector.get_columns(
            "app_user"
        )
    }

    if (
        "company_id" in existing_user_columns
        or "role" in existing_user_columns
    ):
        raise RuntimeError(
            "app_user already contains company_id "
            "or role. Review the current schema "
            "before applying this migration."
        )

    # -------------------------------------------------
    # 2. VERIFY EXISTING MEMBERSHIPS
    # -------------------------------------------------

    # One company per user is required
    # by the new identity design.

    multiple_memberships = connection.execute(
        sa.text(
            """
            SELECT user_id, COUNT(*) AS membership_count
            FROM company_membership
            GROUP BY user_id
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        )
    ).first()

    if multiple_memberships is not None:
        raise RuntimeError(
            "Migration stopped: some users belong "
            "to multiple companies. Resolve those "
            "memberships before migration."
        )

    # Only migrate known existing roles.
    # The previous implementation used 'owner'.
    # We also support records already using the
    # three target role names.

    unsupported_role = connection.execute(
        sa.text(
            """
            SELECT role
            FROM company_membership
            WHERE role IS NULL
               OR role NOT IN (
                   'owner',
                   'admin',
                   'user',
                   'reviewer'
               )
            LIMIT 1
            """
        )
    ).first()

    if unsupported_role is not None:
        raise RuntimeError(
            "Migration stopped: unsupported "
            "company membership role found: "
            f"{unsupported_role.role!r}. "
            "Review and map it explicitly."
        )

    # -------------------------------------------------
    # 3. ADD NEW USER COLUMNS
    # -------------------------------------------------

    # company_id is nullable to support
    # registered accounts awaiting onboarding.

    op.add_column(
        "app_user",
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    op.add_column(
        "app_user",
        sa.Column(
            "role",
            sa.String(length=20),
            nullable=True,
        ),
    )

    # -------------------------------------------------
    # 4. MIGRATE COMPANY + ROLE DATA
    # -------------------------------------------------

    # Existing owner becomes admin.
    # Other supported roles remain unchanged.

    connection.execute(
        sa.text(
            """
            UPDATE app_user AS u
            SET
                company_id = m.company_id,
                role = CASE
                    WHEN m.role = 'owner'
                        THEN 'admin'
                    ELSE m.role
                END
            FROM company_membership AS m
            WHERE u.user_id = m.user_id
            """
        )
    )

    # Users without a membership remain
    # eligible for future company onboarding.

    connection.execute(
        sa.text(
            """
            UPDATE app_user
            SET role = 'user'
            WHERE role IS NULL
            """
        )
    )

    # -------------------------------------------------
    # 5. VERIFY MIGRATED RECORDS
    # -------------------------------------------------

    mismatched_records = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM company_membership AS m
            JOIN app_user AS u
                ON u.user_id = m.user_id
            WHERE
                u.company_id IS DISTINCT FROM
                    m.company_id
                OR
                u.role IS DISTINCT FROM
                    CASE
                        WHEN m.role = 'owner'
                            THEN 'admin'
                        ELSE m.role
                    END
            """
        )
    ).scalar_one()

    if mismatched_records != 0:
        raise RuntimeError(
            "Migration validation failed: "
            "company memberships were not "
            "transferred correctly."
        )

    # -------------------------------------------------
    # 6. APPLY DATABASE CONSTRAINTS
    # -------------------------------------------------

    op.alter_column(
        "app_user",
        "role",
        existing_type=sa.String(length=20),
        nullable=False,
        server_default=sa.text("'user'"),
    )

    op.create_check_constraint(
        "ck_app_user_role",
        "app_user",
        "role IN ('admin', 'user', 'reviewer')",
    )

    op.create_foreign_key(
        "fk_app_user_company",
        "app_user",
        "dim_company",
        ["company_id"],
        ["company_id"],
        ondelete="RESTRICT",
    )

    op.create_index(
        "ix_app_user_company_id",
        "app_user",
        ["company_id"],
    )

    # -------------------------------------------------
    # 7. REMOVE OLD MEMBERSHIP TABLE
    # -------------------------------------------------

    # All memberships have been validated above.
    # Deleting this table is intentionally last.

    op.drop_table(
        "company_membership"
    )


# =====================================================
# DOWNGRADE
# =====================================================

def downgrade() -> None:
    """
    Automatic downgrade is intentionally disabled.

    Downgrading would need to recreate the
    legacy membership structure and determine
    whether an Admin originally had the
    'owner' role.

    Use a separately reviewed reverse
    migration if rollback is necessary.
    """

    raise NotImplementedError(
        "Automatic RBAC downgrade is disabled "
        "to prevent identity data loss."
    )
