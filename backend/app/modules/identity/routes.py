
"""
Nexora.AI - Identity & Authentication Routes

Roles:
- admin
- user
- reviewer

Authentication:
- Register
- Login
- Current user

Admin Management:
- Create users
- List company users
- Get user details
- Update user email
- Change user roles
- Activate / deactivate users
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID
import jwt

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)

from app.modules.company_knowledge.models import DimCompany
from app.modules.identity import crud

from app.modules.identity.models import User

from app.modules.identity.schemas import (
    InvitationAcceptRequest,
    InvitationCreate,
    InvitationRead,
    InvitationVerifyResponse,
    LoginRequest,
    RegisterRead,
    RegisterRequest,
    TokenRead,
    UserCreate,
    UserListResponse,
    UserRead,
    UserRoleUpdate,
    UserStatusUpdate,
    UserUpdate,
)


# =====================================================
# 1. ROUTER CONFIGURATION
# =====================================================

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

user_router = APIRouter(
    prefix="/users",
    tags=["User Management"],
)


# =====================================================
# 2. REGISTER USER
# =====================================================

@router.post(
    "/register",
    response_model=RegisterRead,
    status_code=status.HTTP_201_CREATED,
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new user for company onboarding.

    The account starts with:
    - role = user
    - company_id = None

    Company onboarding will assign the first
    user to their company and grant admin access.
    """

    email = str(request.email).strip().lower()

    existing_user = crud.get_user_by_email(
        db,
        email,
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        )

    try:
        user = crud.create_user(
            db=db,
            email=email,
            password_hash=hash_password(
                request.password
            ),
            company_id=None,
            role="user",
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        ) from None

    return {
        "access_token": create_access_token(
            user.user_id
        ),
        "user": user,
    }


# =====================================================
# 3. LOGIN
# =====================================================

@router.post(
    "/login",
    response_model=TokenRead,
)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate users using email and password.
    """

    email = str(request.email).strip().lower()
    raw_password = str(request.password).strip()

    user = crud.get_user_by_email(
        db,
        email,
    )

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check exact password first
    is_valid = verify_password(raw_password, user.password_hash)

    # Fast fallback: check trimmed or basic case adjustment if exact match fails
    if not is_valid:
        trimmed = raw_password.strip()
        if trimmed != raw_password and verify_password(trimmed, user.password_hash):
            is_valid = True

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(
            user.user_id
        ),
        "user": user,
    }


# =====================================================
# 3b. PASSWORD RESET
# =====================================================

@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
)
def reset_password(
    request: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Reset user password by email.
    """
    email = str(request.email).strip().lower()
    user = crud.get_user_by_email(db, email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account with this email does not exist",
        )

    user.password_hash = hash_password(str(request.password).strip())
    db.commit()
    return {"success": True, "message": "Password reset successfully"}


# =====================================================
# 4. CURRENT USER PROFILE
# =====================================================

@router.get(
    "/me",
    response_model=UserRead,
)
def get_my_profile(
    current_user: User = Depends(
        get_current_user
    ),
):
    """
    Return authenticated user information.
    """

    return current_user


# =====================================================
# 5. ADMIN - CREATE COMPANY USER
# =====================================================

@user_router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def create_company_user(
    request: UserCreate,
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    """
    Only Admin can create company users.

    Admin can assign:
    - admin
    - user
    - reviewer
    """

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    email = str(request.email).strip().lower()

    existing_user = crud.get_user_by_email(
        db,
        email,
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        )

    try:
        user = crud.create_user(
            db=db,
            email=email,
            password_hash=hash_password(
                request.password
            ),
            company_id=current_user.company_id,
            role=request.role,
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        ) from None

    return user


# =====================================================
# 6. ADMIN - LIST COMPANY USERS
# =====================================================

@user_router.get(
    "",
    response_model=UserListResponse,
)
def list_company_users(
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    """
    List users belonging to the Admin's company.
    """

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    users = crud.list_users(
        db,
        current_user.company_id,
    )

    return {
        "total": len(users),
        "items": users,
    }


# =====================================================
# 7. ADMIN - GET USER DETAILS
# =====================================================

@user_router.get(
    "/{user_id}",
    response_model=UserRead,
)
def get_company_user(
    user_id: UUID,
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    """
    Get a user belonging to the same company.
    """

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    user = crud.get_company_user(
        db,
        current_user.company_id,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


# =====================================================
# 8. ADMIN - UPDATE USER DETAILS
# =====================================================

@user_router.patch(
    "/{user_id}",
    response_model=UserRead,
)
def update_company_user(
    user_id: UUID,
    request: UserUpdate,
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    """
    Update user details.

    Current MVP supports updating email.
    """

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    try:
        user = crud.update_user_email(
            db=db,
            company_id=current_user.company_id,
            user_id=user_id,
            email=str(request.email),
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        ) from None

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


# =====================================================
# 9. ADMIN - CHANGE USER ROLE
# =====================================================

@user_router.patch(
    "/{user_id}/role",
    response_model=UserRead,
)
def change_user_role(
    user_id: UUID,
    request: UserRoleUpdate,
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    """
    Change role to:
    - admin
    - user
    - reviewer

    The last active Admin cannot be demoted.
    """

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    try:
        user = crud.update_user_role(
            db=db,
            company_id=current_user.company_id,
            user_id=user_id,
            new_role=request.role,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


# =====================================================
# 10. ADMIN - ACTIVATE / DEACTIVATE USER
# =====================================================

@user_router.patch(
    "/{user_id}/status",
    response_model=UserRead,
)
def change_user_status(
    user_id: UUID,
    request: UserStatusUpdate,
    current_user: User = Depends(
        require_roles("admin")
    ),
    db: Session = Depends(get_db),
):
    """
    Activate or deactivate a company user.

    Deactivated users cannot authenticate.

    The last active Admin cannot be deactivated.
    """

    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    try:
        user = crud.update_user_status(
            db=db,
            company_id=current_user.company_id,
            user_id=user_id,
            is_active=request.is_active,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


# =====================================================
# 11. ADMIN - CREATE TEAM INVITATION
# =====================================================

@user_router.post(
    "/invite",
    response_model=InvitationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    request: InvitationCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """
    Admin invites a Creator or Reviewer to join their company.
    Produces a single-use, company-bound, cryptographically signed invitation token.
    """
    if current_user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Admin is not assigned to a company",
        )

    email = str(request.email).strip().lower()

    existing = crud.get_user_by_email(db, email)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="User with this email is already registered",
        )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=2)

    payload = {
        "sub": email,
        "company_id": str(current_user.company_id),
        "role": request.role,
        "type": "invitation",
        "iat": now,
        "exp": expires_at,
    }

    invitation_token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm="HS256",
    )

    company = db.get(DimCompany, current_user.company_id)
    company_name = company.company_name if company else None

    return {
        "email": email,
        "role": request.role,
        "company_id": current_user.company_id,
        "company_name": company_name,
        "expires_at": expires_at,
        "invitation_token": invitation_token,
        "invite_url": f"/invite/accept?token={invitation_token}",
    }


# =====================================================
# 12. VERIFY TEAM INVITATION TOKEN
# =====================================================

@router.get(
    "/invitations/verify",
    response_model=InvitationVerifyResponse,
)
def verify_invitation_token(
    token: str = Query(..., min_length=10),
    db: Session = Depends(get_db),
):
    """
    Verifies that an invitation token is valid, unexpired, and not yet claimed.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=410,
            detail="Invitation link has expired",
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=400,
            detail="Invalid invitation token",
        ) from None

    if payload.get("type") != "invitation":
        raise HTTPException(
            status_code=400,
            detail="Token is not an invitation token",
        )

    email = payload.get("sub", "").strip().lower()
    company_id = UUID(payload["company_id"])
    role = payload.get("role", "user")

    # Check if user has already accepted or registered
    existing = crud.get_user_by_email(db, email)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Invitation has already been used",
        )

    company = db.get(DimCompany, company_id)
    company_name = company.company_name if company else None
    exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)

    return {
        "email": email,
        "role": role,
        "company_id": company_id,
        "company_name": company_name,
        "expires_at": exp_dt,
    }


# =====================================================
# 13. ACCEPT TEAM INVITATION & SET PASSWORD
# =====================================================

@router.post(
    "/invitations/accept",
    response_model=RegisterRead,
    status_code=status.HTTP_201_CREATED,
)
def accept_invitation(
    request: InvitationAcceptRequest,
    db: Session = Depends(get_db),
):
    """
    Invited user sets their password and claims the account.
    The account is atomically bound to the Admin's company and assigned role.
    """
    try:
        payload = jwt.decode(
            request.token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=410,
            detail="Invitation link has expired",
        ) from None
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=400,
            detail="Invalid invitation token",
        ) from None

    if payload.get("type") != "invitation":
        raise HTTPException(
            status_code=400,
            detail="Token is not an invitation token",
        )

    email = payload.get("sub", "").strip().lower()
    company_id = UUID(payload["company_id"])
    role = payload.get("role", "user")

    if role not in ("admin", "user", "reviewer"):
        raise HTTPException(
            status_code=400,
            detail="Invalid role in invitation token",
        )

    existing = crud.get_user_by_email(db, email)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    company = db.get(DimCompany, company_id)
    if company is None:
        raise HTTPException(
            status_code=404,
            detail="Company associated with invitation no longer exists",
        )

    try:
        user = crud.create_user(
            db=db,
            email=email,
            password_hash=hash_password(request.password),
            company_id=company_id,
            role=role,
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        ) from None

    return {
        "access_token": create_access_token(user.user_id),
        "user": user,
    }
