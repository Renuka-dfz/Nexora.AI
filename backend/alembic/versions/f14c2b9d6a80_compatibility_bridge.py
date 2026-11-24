"""Compatibility bridge for the revision recorded by the existing database.

The original f14c2b9d6a80 migration source is unavailable. This no-op bridge
connects the recorded revision to the repository chain without claiming to
reconstruct its original operations.
"""

from typing import Sequence, Union


revision: str = "f14c2b9d6a80"
down_revision: Union[str, Sequence[str], None] = "e67bc14a2f90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
