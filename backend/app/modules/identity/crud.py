
"""
Nexora.AI - Identity CRUD

Roles:
- admin
- user
- reviewer

Handles:
- Create users
- Retrieve users
- List company users
- Update email
- Change user roles
- Activate / deactivate accounts
- Protect the last active Admin
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.identity.models import User
from app.modules.company_knowledge.models import DimCompany


VALID_ROLES = {"admin", "user", "reviewer"}


# =====================================================
# 1. CREATE USER
# =====================================================

def create_user(
    db: Session,
    email: str,
    password_hash: str,
    company_id: uuid.UUID | None = None,
    role: str = "user",
) -> User:

    if role not in VALID_ROLES:
        raise ValueError("Invalid user role")

    if company_id is None and role != "user":
        raise ValueError(
            "A company must be assigned before granting "
            "Admin or Reviewer access"
        )

    user = User(
        email=email.strip().lower(),
        password_hash=password_hash,
        company_id=company_id,
        role=role,
        is_active=True,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    return user


# =====================================================
# 2. GET USER BY ID
# =====================================================

def get_user(
    db: Session,
    user_id: uuid.UUID,
) -> User | None:

    return db.get(User, user_id)


# =====================================================
# 3. GET USER BY EMAIL
# =====================================================

def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:

    return db.scalar(
        select(User).where(
            User.email == email.strip().lower()
        )
    )


# =====================================================
# 4. LIST COMPANY USERS
# =====================================================

def list_users(
    db: Session,
    company_id: uuid.UUID,
) -> list[User]:

    return list(
        db.scalars(
            select(User)
            .where(User.company_id == company_id)
            .order_by(User.created_at.desc())
        ).all()
    )


# =====================================================
# 5. COUNT COMPANY USERS
# =====================================================

def count_users(
    db: Session,
    company_id: uuid.UUID,
) -> int:

    return db.scalar(
        select(func.count(User.user_id)).where(
            User.company_id == company_id
        )
    ) or 0


# =====================================================
# 6. GET COMPANY USER
# =====================================================

def get_company_user(
    db: Session,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
) -> User | None:

    return db.scalar(
        select(User).where(
            User.company_id == company_id,
            User.user_id == user_id,
        )
    )


# =====================================================
# 7. PROTECT LAST ACTIVE ADMIN
# =====================================================

def _lock_company(
    db: Session,
    company_id: uuid.UUID,
) -> None:
    """
    Serialize role/status changes for this company.

    All Admin role/status changes should use this lock
    so concurrent requests cannot remove the last Admin.
    """

    company = db.scalar(
        select(DimCompany)
        .where(DimCompany.company_id == company_id)
        .with_for_update()
    )

    if company is None:
        raise ValueError("Company not found")


def _count_active_admins(
    db: Session,
    company_id: uuid.UUID,
) -> int:

    return db.scalar(
        select(func.count(User.user_id)).where(
            User.company_id == company_id,
            User.role == "admin",
            User.is_active.is_(True),
        )
    ) or 0


def _protect_last_admin(
    db: Session,
    user: User,
) -> None:

    if (
        user.company_id is not None
        and user.role == "admin"
        and user.is_active
        and _count_active_admins(
            db, user.company_id
        ) <= 1
    ):
        raise ValueError(
            "Cannot remove or deactivate "
            "the last active Admin"
        )


# =====================================================
# 8. UPDATE USER EMAIL
# =====================================================

def update_user_email(
    db: Session,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    email: str,
) -> User | None:

    user = get_company_user(
        db, company_id, user_id
    )

    if user is None:
        return None

    user.email = email.strip().lower()

    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    return user


# =====================================================
# 9. UPDATE USER ROLE
# =====================================================

def update_user_role(
    db: Session,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    new_role: str,
) -> User | None:

    if new_role not in VALID_ROLES:
        raise ValueError("Invalid user role")

    try:
        _lock_company(db, company_id)

        user = get_company_user(
            db, company_id, user_id
        )

        if user is None:
            db.rollback()
            return None

        if user.role != new_role:
            if user.role == "admin":
                _protect_last_admin(db, user)

            user.role = new_role

        db.commit()
        db.refresh(user)
        return user

    except Exception:
        db.rollback()
        raise


# =====================================================
# 10. ACTIVATE / DEACTIVATE USER
# =====================================================

def update_user_status(
    db: Session,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    is_active: bool,
) -> User | None:

    try:
        _lock_company(db, company_id)

        user = get_company_user(
            db, company_id, user_id
        )

        if user is None:
            db.rollback()
            return None

        if user.is_active and not is_active:
            _protect_last_admin(db, user)

        user.is_active = is_active

        db.commit()
        db.refresh(user)
        return user

    except Exception:
        db.rollback()
        raise
