
"""
Nexora.AI - Authentication & Role-Based Access Control

Supported roles:
- admin
- user
- reviewer

Responsibilities:
1. Password hashing and verification
2. JWT access token generation
3. JWT authentication
4. User activity validation
5. Role-based authorization
6. Company-level data access control
"""

from datetime import datetime, timedelta, timezone
from typing import Callable
from uuid import UUID

import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.modules.identity.models import User


# =====================================================
# 1. SECURITY CONFIGURATION
# =====================================================

password_hash = PasswordHash.recommended()

bearer_scheme = HTTPBearer(auto_error=False)

VALID_ROLES = {"admin", "user", "reviewer"}


# =====================================================
# 2. PASSWORD HASHING
# =====================================================

def hash_password(password: str) -> str:
    """Generate a secure password hash."""
    return password_hash.hash(password)


def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    """Verify a password against its stored hash."""
    return password_hash.verify(
        password,
        hashed_password,
    )


# =====================================================
# 3. JWT TOKEN GENERATION
# =====================================================

def create_access_token(user_id: UUID) -> str:
    """
    Generate a JWT for an authenticated user.

    The token contains the user ID.
    The user's current role is checked against
    PostgreSQL during each authenticated request.
    """

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm="HS256",
    )


# =====================================================
# 4. GET CURRENT AUTHENTICATED USER
# =====================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate JWT and retrieve the authenticated user.

    Reject:
    - Missing tokens
    - Invalid or expired tokens
    - Non-existent users
    - Deactivated users
    """

    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )

        user_id = UUID(payload["sub"])

    except (
        InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ):
        raise unauthorized from None

    user = db.get(User, user_id)

    if user is None or not user.is_active:
        raise unauthorized

    if user.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role",
        )

    return user


# =====================================================
# 5. ROLE-BASED AUTHORIZATION
# =====================================================

def require_roles(
    *allowed_roles: str,
) -> Callable:
    """
    FastAPI dependency for role-based access.

    Example:

    Depends(require_roles("admin"))

    Depends(require_roles("admin", "reviewer"))
    """

    if (
        not allowed_roles
        or not set(allowed_roles).issubset(VALID_ROLES)
    ):
        raise ValueError(
            "Invalid RBAC role configuration"
        )

    def role_checker(
        user: User = Depends(get_current_user),
    ) -> User:

        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to perform this action"
                ),
            )

        return user

    return role_checker


# =====================================================
# 6. COMPANY ACCESS VALIDATION
# =====================================================

def ensure_company_access(
    db: Session,
    user: User,
    company_id: UUID,
    allowed_roles: tuple[str, ...] | None = None,
) -> None:
    """
    Ensure the authenticated user belongs
    to the requested company.

    Optionally enforce allowed roles.

    Examples:

    ensure_company_access(db, user, company_id)

    ensure_company_access(
        db, user, company_id,
        allowed_roles=("admin",)
    )
    """

    from app.modules.company_knowledge.models import (
        DimCompany
    )

    company = db.get(DimCompany, company_id)

    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    if (
        user.company_id is None
        or user.company_id != company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this company",
        )

    if allowed_roles is not None:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your role does not allow "
                    "this operation"
                ),
            )
