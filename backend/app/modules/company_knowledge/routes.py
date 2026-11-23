
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

import logging
from datetime import datetime, timezone
from urllib.parse import urlsplit
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
    WebsiteCrawlJob,
)

from app.modules.company_knowledge.schemas import (
    CategoryListResponse,
    CompanyCreate,
    CompanyKnowledgeContext,
    CompanyRead,
    CompanyUpdate,
    KnowledgeCreate,
    KnowledgeListResponse,
    KnowledgeQueryRequest,
    KnowledgeRead,
    KnowledgeUpdate,
    KnowledgeVerificationUpdate,
    SourceCreate,
    SourceListResponse,
    SourceRead,
    WebsiteCrawlJobRead,
    WebsiteCrawlRequest,
)
from app.rag.llm import GroundedRAGResponse
from app.modules.company_knowledge.services.website_validation import (
    WebsiteValidationError,
    canonicalize_url,
    validate_website,
)
from app.modules.company_knowledge.tasks import crawl_website_task


router = APIRouter(
    tags=["Company Intelligence"]
)
logger = logging.getLogger(__name__)


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


@router.post(
    "/companies/{company_id}/website-crawls",
    response_model=WebsiteCrawlJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_website_crawl(
    company_id: UUID,
    request: WebsiteCrawlRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin",),
    )

    company = crud.get_company(db, company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    # Policy: Only registered company websites are accepted for crawling
    if company.website_url:
        try:
            registered_canonical = canonicalize_url(company.website_url)
            registered_host = (urlsplit(registered_canonical).hostname or "").lower().removeprefix("www.")
            requested_canonical = canonicalize_url(str(request.website_url))
            requested_host = (urlsplit(requested_canonical).hostname or "").lower().removeprefix("www.")
        except WebsiteValidationError as exc:
            raise HTTPException(
                status_code=exc.status_code,
                detail={"code": exc.code, "message": exc.message},
            ) from exc

        if requested_host != registered_host:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "unregistered_website",
                    "message": f"Only your company's registered website ({company.website_url}) is accepted for crawling. To crawl a different site, update your registered website in Company Settings.",
                },
            )
    else:
        # If no registered website was set previously, register this URL as the company's verified domain
        company.website_url = str(request.website_url)
        db.add(company)
        db.flush()

    try:
        validated = await validate_website(str(request.website_url))
    except WebsiteValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc

    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_url == validated.website_url,
        )
    )
    if source is None:
        source = DimSource(
            company_id=company_id,
            source_url=validated.website_url,
            source_type="website",
        )
        db.add(source)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            source = db.scalar(
                select(DimSource).where(
                    DimSource.company_id == company_id,
                    DimSource.source_url == validated.website_url,
                )
            )
            if source is None:
                raise HTTPException(
                    status_code=409,
                    detail="Website source creation conflict",
                ) from None
    source.source_type = "website"

    job = WebsiteCrawlJob(
        company_id=company_id,
        source_id=source.source_id,
        requested_by=user.user_id,
        website_url=validated.website_url,
        sitemap_urls=validated.sitemap_urls,
        sitemap_available=validated.sitemap_available,
        status="queued",
    )
    db.add(job)

    try:
        db.commit()
        db.refresh(job)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "code": "crawl_job_conflict",
                "message": "A crawl job could not be created for this website.",
            },
        ) from None

    try:
        crawl_website_task.delay(str(job.job_id))
    except Exception as exc:
        logger.exception(
            "Could not enqueue website crawl",
            extra={"job_id": str(job.job_id)},
        )
        job.status = "failed"
        job.error_code = "queue_unavailable"
        job.error_message = (
            "The crawl queue is unavailable. Check that Redis and a Celery worker are running."
        )
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=503,
            detail={
                "code": job.error_code,
                "message": job.error_message,
                "job_id": str(job.job_id),
            },
        ) from exc

    return job


@router.get(
    "/companies/{company_id}/website-crawls/{job_id}",
    response_model=WebsiteCrawlJobRead,
)
def get_website_crawl_status(
    company_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_company_permission(db, user, company_id)
    job = db.scalar(
        select(WebsiteCrawlJob).where(
            WebsiteCrawlJob.company_id == company_id,
            WebsiteCrawlJob.job_id == job_id,
        )
    )
    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Website crawl job not found",
        )
    return job


@router.post(
    "/companies/{company_id}/website-crawls/{job_id}/cancel",
    response_model=WebsiteCrawlJobRead,
    status_code=status.HTTP_200_OK,
)
def cancel_website_crawl(
    company_id: UUID,
    job_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cancel an in-progress or queued website crawl job.
    Marks status as failed with error_code='cancelled_by_user'.
    """
    check_company_permission(db, user, company_id, allowed_roles=("admin",))
    job = db.scalar(
        select(WebsiteCrawlJob).where(
            WebsiteCrawlJob.company_id == company_id,
            WebsiteCrawlJob.job_id == job_id,
        )
    )
    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Website crawl job not found",
        )
    if job.status in ("queued", "running"):
        job.status = "failed"
        job.error_code = "cancelled_by_user"
        job.error_message = "Crawl job was cancelled by user."
        job.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)
    return job


# =====================================================
# 7b. TRIGGER RAG INDEXING FOR VERIFIED COMPANY FACTS
# =====================================================

@router.post(
    "/companies/{company_id}/rag/index",
    status_code=status.HTTP_200_OK,
)
def trigger_company_rag_indexing(
    company_id: UUID,
    batch_size: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Idempotently index all verified and eligible Company Intelligence facts into pgvector.

    Only users with 'admin' role can trigger company-wide indexing.
    Unverified or pending facts are strictly omitted (fail-closed).
    """
    check_company_permission(db, user, company_id, allowed_roles=["admin"])
    from app.rag.indexing import index_company_knowledge

    result = index_company_knowledge(
        db,
        company_id=company_id,
        batch_size=batch_size,
    )
    return result


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
        FactCompanyIntelligence.company_id == company_id,
        FactCompanyIntelligence.is_current.is_(True),
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
            FactCompanyIntelligence.is_current.is_(True),
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
            FactCompanyIntelligence.is_current.is_(True),
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


# =====================================================
# 16. HYBRID COMPANY KNOWLEDGE RETRIEVAL
# =====================================================

@router.post(
    "/companies/{company_id}/knowledge/query",
    response_model=CompanyKnowledgeContext,
    status_code=status.HTTP_200_OK,
)
def query_company_knowledge(
    company_id: UUID,
    payload: KnowledgeQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve company knowledge through the hybrid access layer.

    Combines direct PostgreSQL structured queries with pgvector semantic retrieval.
    Routes automatically based on request query/intent, or explicit mode override.
    """
    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin", "user", "reviewer"),
    )

    if payload.company_id != company_id:
        raise HTTPException(
            status_code=400,
            detail="Payload company_id does not match route company_id",
        )

    from app.modules.company_knowledge.services.knowledge_router import (
        retrieve_company_knowledge,
    )

    return retrieve_company_knowledge(db, payload)


# =====================================================
# 17. GROUNDED RAG ANSWER GENERATION
# =====================================================

@router.post(
    "/companies/{company_id}/knowledge/answer",
    response_model=GroundedRAGResponse,
    status_code=status.HTTP_200_OK,
)
def answer_company_knowledge(
    company_id: UUID,
    payload: KnowledgeQueryRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate an evidence-grounded answer to a user question using PostgreSQL + pgvector RAG
    and local Ollama (qwen3.5:4b).

    Strict fail-closed guarantee:
    If the question cannot be answered from verified data, or if the user asks a wrong or
    unsupported question, the system explicitly returns:
    "I don't have enough information about this."
    """
    check_company_permission(
        db,
        user,
        company_id,
        allowed_roles=("admin", "user", "reviewer"),
    )

    if payload.company_id != company_id:
        raise HTTPException(
            status_code=400,
            detail="Payload company_id does not match route company_id",
        )

    if not payload.query or not payload.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Query is required for answer generation",
        )

    from app.modules.company_knowledge.services.knowledge_router import (
        retrieve_company_knowledge,
    )
    from app.rag.llm import generate_grounded_answer

    context = retrieve_company_knowledge(db, payload)
    return generate_grounded_answer(
        question=payload.query,
        company_context=context.context_text,
    )

