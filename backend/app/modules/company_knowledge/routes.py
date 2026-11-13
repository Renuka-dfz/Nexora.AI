
"""
Nexora.AI - Company Intelligence Routes

Role-Based Access Control:
- admin
- user
- reviewer

Features:
1. Secure initial company onboarding
2. Company profile management
3. Intelligence categories
4. Website and document sources
5. Company knowledge CRUD
6. Company knowledge verification

Uses:
- User.company_id
- User.role

No CompanyMembership dependency.
"""

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status,
)

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.core.security import (
    ensure_company_access,
    get_current_user,
)

from app.modules.identity.models import User

from app.modules.company_knowledge import crud

from app.modules.company_knowledge.models import (
    DimCompany,
    DimSource,
    FactCompanyIntelligence,
)

from app.modules.company_knowledge.schemas import (
    CategoryListResponse,
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    KnowledgeCreate,
    KnowledgeListResponse,
    KnowledgeRead,
    KnowledgeUpdate,
    KnowledgeVerificationUpdate,
    SourceCreate,
    SourceListResponse,
    SourceRead,
)


router = APIRouter(
    tags=["Company Intelligence"]
)


# =====================================================
# 1. SECURE COMPANY ACCESS HELPER
# =====================================================

def check_company_permission(
    db: Session,
    user: User,
    company_id: UUID,
    allowed_roles: tuple[str, ...] | None = None,
) -> None:
    """
    Check both:
    1. Company ownership/access
    2. Allowed user roles

    The user's company is taken from the database,
    not from an untrusted client-provided identity.
    """

    ensure_company_access(
        db=db,
        user=user,
        company_id=company_id,
        allowed_roles=allowed_roles,
    )


# =====================================================
# 2. CREATE COMPANY - INITIAL ONBOARDING
# =====================================================

@router.post(
    "/companies",
    response_model=CompanyRead,
    status_code=status.HTTP_201_CREATED,
)
def create_company(
    request: CompanyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Initial company onboarding.

    Only a registered user who does not yet belong
    to a company can create their company.

    After successful company creation:
    - User.company_id = new company ID
    - User.role = admin

    Both operations commit in one transaction.
    """

    try:
        # Lock user row to prevent simultaneous
        # onboarding requests from creating
        # multiple companies for the same user.
        locked_user = db.scalar(
            select(User)
            .where(User.user_id == user.user_id)
            .with_for_update()
        )

        if locked_user is None or not locked_user.is_active:
            raise HTTPException(
                status_code=401,
                detail="Active user account required",
            )

        if locked_user.company_id is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "User already belongs to a company"
                ),
            )

        if locked_user.role != "user":
            raise HTTPException(
                status_code=403,
                detail=(
                    "Account is not eligible "
                    "for company onboarding"
                ),
            )

        values = request.model_dump()

        if values.get("website_url") is not None:
            values["website_url"] = str(
                values["website_url"]
            )

        company = DimCompany(**values)

        db.add(company)
        db.flush()

        # Assign first company user as Admin.
        locked_user.company_id = company.company_id
        locked_user.role = "admin"

        db.commit()
        db.refresh(company)

        return company

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Company onboarding conflict",
        ) from None

    except Exception:
        db.rollback()
        raise


# =====================================================
# 3. GET COMPANY PROFILE
# =====================================================

@router.get(
    "/companies/{company_id}",
    response_model=CompanyRead,
)
def get_company(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin, User and Reviewer can
    view their company profile.
    """

    check_company_permission(
        db,
        user,
        company_id,
    )

    company = crud.get_company(
        db,
        company_id,
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail="Company not found",
        )

    return company


# =====================================================
# 4. UPDATE COMPANY PROFILE - ADMIN ONLY
# =====================================================

@router.patch(
    "/companies/{company_id}",
    response_model=CompanyRead,
)
def update_company(
    company_id: UUID,
    request: CompanyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Only Admin can update company settings.
    """

    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin",),
    )

    updates = request.model_dump(
        exclude_unset=True
    )

    if updates.get("website_url") is not None:
        updates["website_url"] = str(
            updates["website_url"]
        )

    company = crud.update_company(
        db,
        company_id,
        updates,
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail="Company not found",
        )

    return company


# =====================================================
# 5. LIST COMPANY INTELLIGENCE CATEGORIES
# =====================================================

@router.get(
    "/companies/{company_id}/knowledge/categories",
    response_model=CategoryListResponse,
)
def list_categories(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All three roles can view categories.
    """

    check_company_permission(
        db,
        user,
        company_id,
    )

    categories = crud.get_categories(db)

    return {
        "total": len(categories),
        "items": categories,
    }


# =====================================================
# 6. LIST ALL CATEGORIES - COMPATIBILITY API
# =====================================================

@router.get(
    "/categories",
    response_model=CategoryListResponse,
)
def list_all_categories(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Existing categories endpoint.

    Requires an onboarded company user.
    """

    if user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Company onboarding required",
        )

    categories = crud.get_categories(db)

    return {
        "total": len(categories),
        "items": categories,
    }


# =====================================================
# 7. CREATE SOURCE - ADMIN / USER
# =====================================================

@router.post(
    "/companies/{company_id}/sources",
    response_model=SourceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_source(
    company_id: UUID,
    request: SourceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin and User can add information sources.

    Reviewer cannot add sources.
    """

    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin", "user"),
    )

    source_url = str(request.source_url)

    existing_source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_url == source_url,
        )
    )

    if existing_source is not None:
        raise HTTPException(
            status_code=409,
            detail="Source URL already exists",
        )

    source = DimSource(
        company_id=company_id,
        source_url=source_url,
        source_type=request.source_type,
        page_title=request.page_title,
    )

    db.add(source)

    try:
        db.commit()
        db.refresh(source)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Source creation conflict",
        ) from None

    return source


# =====================================================
# 8. LIST COMPANY SOURCES
# =====================================================

@router.get(
    "/companies/{company_id}/sources",
    response_model=SourceListResponse,
)
def list_sources(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All three roles can view company sources.
    """

    check_company_permission(
        db,
        user,
        company_id,
    )

    sources = db.scalars(
        select(DimSource)
        .where(
            DimSource.company_id == company_id
        )
        .order_by(DimSource.source_url)
    ).all()

    return {
        "company_id": company_id,
        "total": len(sources),
        "items": sources,
    }


# =====================================================
# 9. GET SOURCE DETAILS
# =====================================================

@router.get(
    "/companies/{company_id}/sources/{source_id}",
    response_model=SourceRead,
)
def get_source(
    company_id: UUID,
    source_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All roles can view a source belonging
    to their company.
    """

    check_company_permission(
        db,
        user,
        company_id,
    )

    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_id == source_id,
        )
    )

    if source is None:
        raise HTTPException(
            status_code=404,
            detail="Source not found",
        )

    return source


# =====================================================
# 10. LIST COMPANY KNOWLEDGE
# =====================================================

@router.get(
    "/companies/{company_id}/knowledge",
    response_model=KnowledgeListResponse,
)
def list_company_knowledge(
    company_id: UUID,

    category_id: int | None = Query(
        default=None,
        gt=0,
    ),

    verification_status: str | None = Query(
        default=None,
        pattern=(
            "^(pending|verified|rejected|conflicting)$"
        ),
    ),

    limit: int = Query(
        default=50,
        ge=1,
        le=100,
    ),

    offset: int = Query(
        default=0,
        ge=0,
    ),

    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All roles can view company knowledge.

    Supports:
    - Category filtering
    - Verification status filtering
    - Pagination
    """

    check_company_permission(
        db,
        user,
        company_id,
    )

    if (
        category_id is not None
        and crud.get_category(
            db,
            category_id,
        ) is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Unknown category_id",
        )

    filters = [
        FactCompanyIntelligence.company_id
        == company_id
    ]

    if category_id is not None:
        filters.append(
            FactCompanyIntelligence.category_id
            == category_id
        )

    if verification_status is not None:
        filters.append(
            FactCompanyIntelligence.verification_status
            == verification_status
        )

    total = db.scalar(
        select(func.count())
        .select_from(FactCompanyIntelligence)
        .where(*filters)
    ) or 0

    items = db.scalars(
        select(FactCompanyIntelligence)
        .where(*filters)
        .order_by(
            FactCompanyIntelligence.extracted_at.desc()
        )
        .limit(limit)
        .offset(offset)
    ).all()

    return {
        "company_id": company_id,
        "total": total,
        "items": items,
    }


# =====================================================
# 11. CREATE COMPANY KNOWLEDGE - ADMIN / USER
# =====================================================

@router.post(
    "/companies/{company_id}/knowledge",
    response_model=KnowledgeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_company_knowledge(
    company_id: UUID,
    request: KnowledgeCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin and User can add company knowledge.

    New knowledge starts with pending verification.
    """

    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin", "user"),
    )

    if crud.get_category(
        db,
        request.category_id,
    ) is None:
        raise HTTPException(
            status_code=422,
            detail="Unknown category_id",
        )

    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_id == request.source_id,
        )
    )

    if source is None:
        raise HTTPException(
            status_code=404,
            detail="Source not found",
        )

    return crud.create_company_information(
        db=db,
        company_id=company_id,
        category_id=request.category_id,
        source_id=source.source_id,
        title=request.title,
        description=request.description,
    )


# =====================================================
# 12. GET COMPANY KNOWLEDGE ITEM
# =====================================================

@router.get(
    "/companies/{company_id}/knowledge/{fact_id}",
    response_model=KnowledgeRead,
)
def get_company_knowledge(
    company_id: UUID,
    fact_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All roles can view company knowledge.
    """

    check_company_permission(
        db,
        user,
        company_id,
    )

    fact = db.scalar(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.company_id
            == company_id,
            FactCompanyIntelligence.fact_id
            == fact_id,
        )
    )

    if fact is None:
        raise HTTPException(
            status_code=404,
            detail="Knowledge item not found",
        )

    return fact


# =====================================================
# 13. UPDATE COMPANY KNOWLEDGE - ADMIN / USER
# =====================================================

@router.patch(
    "/companies/{company_id}/knowledge/{fact_id}",
    response_model=KnowledgeRead,
)
def update_company_knowledge(
    company_id: UUID,
    fact_id: UUID,
    request: KnowledgeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin and User can edit company knowledge.

    Editing resets verification status to pending,
    as implemented in the existing CRUD layer.
    """

    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin", "user"),
    )

    fact = crud.update_company_information(
        db,
        company_id,
        fact_id,
        request.model_dump(
            exclude_unset=True
        ),
    )

    if fact is None:
        raise HTTPException(
            status_code=404,
            detail="Knowledge item not found",
        )

    return fact


# =====================================================
# 14. VERIFY KNOWLEDGE - ADMIN / REVIEWER
# =====================================================

@router.patch(
    "/companies/{company_id}/knowledge/"
    "{fact_id}/verification",
    response_model=KnowledgeRead,
)
def verify_company_knowledge(
    company_id: UUID,
    fact_id: UUID,
    request: KnowledgeVerificationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Only Admin and Reviewer can verify or reject
    extracted company information.

    User cannot approve knowledge.
    """

    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin", "reviewer"),
    )

    fact = db.scalar(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.company_id
            == company_id,
            FactCompanyIntelligence.fact_id
            == fact_id,
        )
    )

    if fact is None:
        raise HTTPException(
            status_code=404,
            detail="Knowledge item not found",
        )

    fact.verification_status = (
        request.verification_status
    )

    db.commit()
    db.refresh(fact)

    return fact


# =====================================================
# 15. DELETE KNOWLEDGE - ADMIN ONLY
# =====================================================

@router.delete(
    "/companies/{company_id}/knowledge/{fact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_company_knowledge(
    company_id: UUID,
    fact_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Only Admin can delete company knowledge.
    """

    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin",),
    )

    deleted = crud.delete_company_information(
        db,
        company_id,
        fact_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Knowledge item not found",
        )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )
