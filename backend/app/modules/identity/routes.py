
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

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)

from app.modules.identity import crud

from app.modules.identity.models import User

from app.modules.identity.schemas import (
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

    user = crud.get_user_by_email(
        db,
        email,
    )

    if (
        user is None
        or not user.is_active
        or not verify_password(
            request.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    return {
        "access_token": create_access_token(
            user.user_id
        ),
    }


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
