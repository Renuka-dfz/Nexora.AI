
"""
Nexora.AI - Marketing API Routes

Role-Based Access Control:
- admin
- user
- reviewer

Modules:
1. Marketing Content
2. Content Approval Workflow
3. Social Accounts
4. Marketing Analytics

Uses the shared User model and company-level
authorization. No CompanyMembership dependency.
"""

from uuid import UUID
from datetime import datetime, timezone
from urllib.parse import urlparse

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
from app.integrations.instagram.caption import clean_instagram_caption

from app.modules.identity.models import User
from app.modules.marketing import crud

from app.modules.marketing.models import (
    DimContent,
    DimContentGenerationBatch,
    DimSocialAccount,
    FactMarketingPerformance,
)

from app.modules.marketing.schemas import (
    ContentCreate,
    ContentGenerateRequest,
    ContentListResponse,
    ContentRead,
    ContentRejectionRequest,
    ContentUpdate,
    PerformanceCreate,
    PerformanceListResponse,
    PerformanceRead,
    SocialAccountCreate,
    SocialAccountListResponse,
    SocialAccountRead,
    SocialAccountUpdate,
    WeeklyGenerationRequest,
    ContentGenerationBatchRead,
)


router = APIRouter(
    prefix="/marketing",
    tags=["Marketing"],
)


# =====================================================
# 1. AUTHORIZATION HELPERS
# =====================================================

def _authorized_content(
    db: Session,
    user: User,
    content_id: UUID,
) -> DimContent:
    """
    Retrieve content and validate company access.
    """

    content = db.get(DimContent, content_id)

    if content is None:
        raise HTTPException(
            status_code=404,
            detail="Content not found",
        )

    ensure_company_access(
        db,
        user,
        content.company_id,
    )

    return content


def _authorized_social_account(
    db: Session,
    user: User,
    account_id: UUID,
) -> DimSocialAccount:
    """
    Retrieve social account and validate company.
    """

    account = db.get(
        DimSocialAccount,
        account_id,
    )

    if account is None:
        raise HTTPException(
            status_code=404,
            detail="Social account not found",
        )

    ensure_company_access(
        db,
        user,
        account.company_id,
    )

    return account


# =====================================================
# 2. CREATE MARKETING CONTENT
# ADMIN / USER
# =====================================================

@router.post(
    "/content",
    response_model=ContentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_content(
    request: ContentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin and User can create marketing content.
    """

    ensure_company_access(
        db,
        user,
        request.company_id,
        allowed_roles=("admin", "user"),
    )

    return crud.create_content(
        db,
        **request.model_dump(
            exclude={"company_id"}
        ),
        company_id=request.company_id,
    )


# =====================================================
# 2b. GENERATE MARKETING CONTENT (AI AGENT)
# ADMIN / USER (CREATOR)
# =====================================================

@router.post(
    "/content/generate",
    response_model=ContentRead,
    status_code=status.HTTP_201_CREATED,
)
def generate_content(
    request: ContentGenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate grounded marketing content using the Marketing Agent (LangGraph + RAG).
    Restricted to Admin and Creator (User). Reviewer cannot generate content.
    Generates a draft with approval_status='draft'.
    """
    if user.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company onboarding required",
        )

    if user.role not in ("admin", "user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role does not permit generating AI content",
        )

    from app.agents.marketing_agent.graph import build_marketing_agent_graph
    from app.core.logger import workflow_logger

    start_time = workflow_logger.start_pipeline(
        workflow_name="Marketing Agent Content Studio",
        topic=request.topic,
        platform=request.platform,
        format_type=request.content_type,
        company_id=user.company_id,
    )

    graph = build_marketing_agent_graph(db)
    initial_state = {
        "company_id": user.company_id,
        "user_id": user.user_id,
        "topic": request.topic,
        "platform": request.platform,
        "content_type": request.content_type,
        "tone": request.tone,
        "instructions": request.instructions,
        "multi_stage": request.multi_stage,
        "is_article": (request.content_type == "article" or request.platform in ("article", "linkedin_article")),
    }

    result = graph.invoke(initial_state)

    if result.get("status") == "failed":
        err_msg = result.get("error") or "Content generation failed"
        workflow_logger.error_pipeline(
            workflow_name="Marketing Agent Content Studio",
            start_time=start_time,
            error_message=err_msg,
            stage="graph_execution",
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=err_msg,
        )

    if result.get("status") == "insufficient_information":
        err_msg = "Insufficient verified company knowledge to ground this marketing request."
        workflow_logger.error_pipeline(
            workflow_name="Marketing Agent Content Studio",
            start_time=start_time,
            error_message=err_msg,
            stage="rag_retrieval",
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=err_msg,
        )

    content_id = result.get("content_id")
    if not content_id:
        val_report = result.get("validation_report") or {}
        findings = [f.get("details") for f in val_report.get("findings", []) if not f.get("passed")]
        reason = findings[0] if findings else "Content failed safety guardrails or lacks sufficient grounded evidence."
        workflow_logger.error_pipeline(
            workflow_name="Marketing Agent Content Studio",
            start_time=start_time,
            error_message=reason,
            stage="validation_guardrails",
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Content generation declined: {reason}",
        )

    content = db.get(DimContent, content_id)
    if content is None:
        workflow_logger.error_pipeline(
            workflow_name="Marketing Agent Content Studio",
            start_time=start_time,
            error_message="Draft not found in database post-save",
            stage="persistence",
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Generated content draft not found in database.",
        )

    workflow_logger.complete_pipeline(
        workflow_name="Marketing Agent Content Studio",
        start_time=start_time,
        content_id=content_id,
        status="DRAFT_SAVED",
    )

    return content



@router.post(
    "/content/generate-weekly",
    response_model=ContentGenerationBatchRead,
    status_code=status.HTTP_202_ACCEPTED,
)
def generate_weekly_content(
    request: WeeklyGenerationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company onboarding required")
    if user.role not in ("admin", "user"):
        raise HTTPException(status_code=403, detail="Your role does not permit generating AI content")

    existing = db.scalar(
        select(DimContentGenerationBatch)
        .where(
            DimContentGenerationBatch.company_id == user.company_id,
            DimContentGenerationBatch.status.in_(("queued", "generating")),
        )
        .order_by(DimContentGenerationBatch.created_at.desc())
    )
    if existing:
        posts = db.scalars(
            select(DimContent)
            .where(DimContent.generation_batch_id == existing.batch_id)
            .order_by(DimContent.scheduled_at.asc())
        ).all()
        return {
            "batch_id": existing.batch_id,
            "company_id": existing.company_id,
            "platform": existing.platform,
            "mode": existing.mode,
            "status": existing.status,
            "prompt": existing.prompt,
            "total_requested": existing.total_requested,
            "total_created": existing.total_created,
            "error_message": existing.error_message,
            "created_at": existing.created_at,
            "completed_at": existing.completed_at,
            "posts": posts,
        }

    batch = DimContentGenerationBatch(
        company_id=user.company_id,
        user_id=user.user_id,
        platform=request.platform,
        mode=request.mode,
        status="queued",
        prompt=request.prompt,
        total_requested=5,
        total_created=0,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    try:
        from app.modules.marketing.tasks import generate_weekly_batch_task
        generate_weekly_batch_task.delay(
            str(batch.batch_id),
            request.content_type,
            request.instructions,
            request.tone,
        )
    except Exception as exc:
        batch.status = "failed"
        batch.error_message = "The background generation queue is unavailable."
        batch.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="The background generation queue is unavailable.",
        ) from exc

    return {
        "batch_id": batch.batch_id,
        "company_id": batch.company_id,
        "platform": batch.platform,
        "mode": batch.mode,
        "status": batch.status,
        "prompt": batch.prompt,
        "total_requested": batch.total_requested,
        "total_created": batch.total_created,
        "error_message": batch.error_message,
        "created_at": batch.created_at,
        "completed_at": batch.completed_at,
        "posts": [],
    }


@router.get(
    "/content/batches/latest",
    response_model=ContentGenerationBatchRead | None,
)
def get_latest_weekly_generation_batch(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="Company onboarding required")

    batch = db.scalar(
        select(DimContentGenerationBatch)
        .where(DimContentGenerationBatch.company_id == user.company_id)
        .order_by(DimContentGenerationBatch.created_at.desc())
        .limit(1)
    )
    if batch is None:
        return None

    posts = db.scalars(
        select(DimContent)
        .where(DimContent.generation_batch_id == batch.batch_id)
        .order_by(DimContent.scheduled_at.asc(), DimContent.created_at.asc())
    ).all()
    return {
        "batch_id": batch.batch_id,
        "company_id": batch.company_id,
        "platform": batch.platform,
        "mode": batch.mode,
        "status": batch.status,
        "prompt": batch.prompt,
        "total_requested": batch.total_requested,
        "total_created": batch.total_created,
        "error_message": batch.error_message,
        "created_at": batch.created_at,
        "completed_at": batch.completed_at,
        "posts": posts,
    }


@router.get(
    "/content/batches/{batch_id}",
    response_model=ContentGenerationBatchRead,
)
def get_weekly_generation_batch(
    batch_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch = db.get(DimContentGenerationBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Generation batch not found")
    ensure_company_access(db, user, batch.company_id)
    posts = db.scalars(
        select(DimContent)
        .where(DimContent.generation_batch_id == batch_id)
        .order_by(DimContent.scheduled_at.asc())
    ).all()
    return {
        "batch_id": batch.batch_id,
        "company_id": batch.company_id,
        "platform": batch.platform,
        "mode": batch.mode,
        "status": batch.status,
        "prompt": batch.prompt,
        "total_requested": batch.total_requested,
        "total_created": batch.total_created,
        "error_message": batch.error_message,
        "created_at": batch.created_at,
        "completed_at": batch.completed_at,
        "posts": posts,
    }


# =====================================================
# 3. LIST MARKETING CONTENT
# ALL ROLES
# =====================================================

@router.get(
    "/content",
    response_model=ContentListResponse,
)
def list_content(
    company_id: UUID,

    platform: str | None = Query(
        default=None,
        min_length=1,
        max_length=30,
    ),

    status_filter: str | None = Query(
        default=None,
        alias="status",
        pattern="^(draft|pending|approved|rejected)$",
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
    All three roles can view company content.
    """

    ensure_company_access(
        db,
        user,
        company_id,
    )

    filters = [
        DimContent.company_id == company_id
    ]

    if status_filter is not None:
        filters.append(
            DimContent.approval_status == status_filter
        )

    if platform is not None:
        filters.append(
            DimContent.platform_target == platform
        )

    total = db.scalar(
        select(func.count())
        .select_from(DimContent)
        .where(*filters)
    ) or 0

    items = db.scalars(
        select(DimContent)
        .where(*filters)
        .order_by(
            DimContent.created_at.desc()
        )
        .limit(limit)
        .offset(offset)
    ).all()

    return {
        "total": total,
        "items": items,
    }


# =====================================================
# 4. GET MARKETING CONTENT
# ALL ROLES
# =====================================================

@router.get(
    "/content/{content_id}",
    response_model=ContentRead,
)
def get_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _authorized_content(
        db,
        user,
        content_id,
    )


# =====================================================
# 5. EDIT MARKETING CONTENT
# ADMIN / USER
# =====================================================

@router.patch(
    "/content/{content_id}",
    response_model=ContentRead,
)
def edit_content(
    content_id: UUID,
    request: ContentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = _authorized_content(
        db,
        user,
        content_id,
    )

    ensure_company_access(
        db,
        user,
        content.company_id,
        allowed_roles=("admin", "user"),
    )

    try:
        updated_content = crud.update_content(
            db,
            content.company_id,
            content_id,
            **request.model_dump(
                exclude_unset=True
            ),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    if updated_content is None:
        raise HTTPException(
            status_code=404,
            detail="Content not found",
        )

    return updated_content


# =====================================================
# 6. DELETE MARKETING CONTENT
# ADMIN / USER
# =====================================================

@router.delete(
    "/content/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = _authorized_content(
        db,
        user,
        content_id,
    )

    ensure_company_access(
        db,
        user,
        content.company_id,
        allowed_roles=("admin", "user"),
    )

    try:
        deleted = crud.delete_content(
            db,
            content.company_id,
            content_id,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=409,
            detail=str(exc),
        ) from exc

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Content not found",
        )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


# =====================================================
# 7. CONTENT APPROVAL WORKFLOW
# =====================================================

def _transition_content(
    db: Session,
    user: User,
    content_id: UUID,
    action: str,
) -> DimContent:
    """
    Content workflow:

    draft -> pending -> approved/rejected

    Submit:
        admin, user

    Approve/Reject:
        admin, reviewer
    """

    content = _authorized_content(
        db,
        user,
        content_id,
    )

    if action == "submit":
        allowed_roles = ("admin", "user")
    else:
        allowed_roles = ("admin", "reviewer")

    ensure_company_access(
        db,
        user,
        content.company_id,
        allowed_roles=allowed_roles,
    )

    allowed_transitions = {
        "submit": {"draft", "rejected"},
        "approve": {"pending"},
        "reject": {"pending"},
    }

    if action not in allowed_transitions:
        raise HTTPException(
            status_code=400,
            detail="Invalid content action",
        )

    if (
        content.approval_status
        not in allowed_transitions[action]
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot {action} content with "
                f"status '{content.approval_status}'"
            ),
        )

    if action in ("submit", "approve") and content.platform_target == "instagram":
        image_url = (content.image_url or "").strip()
        parsed_image_url = urlparse(image_url)
        if parsed_image_url.scheme != "https" or not parsed_image_url.netloc:
            raise HTTPException(
                status_code=409,
                detail="Instagram content needs a saved public HTTPS image before submission or approval.",
            )
        caption = clean_instagram_caption(content.content_text)
        if not caption:
            raise HTTPException(
                status_code=409,
                detail="Instagram content needs a non-empty caption before approval.",
            )
        content.caption = caption

    new_status = {
        "submit": "pending",
        "approve": "approved",
        "reject": "rejected",
    }

    content.approval_status = new_status[action]

    db.commit()
    db.refresh(content)

    return content


# =====================================================
# 8. SUBMIT CONTENT FOR APPROVAL
# ADMIN / USER
# =====================================================

@router.post(
    "/content/{content_id}/submit",
    response_model=ContentRead,
)
def submit_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _transition_content(
        db,
        user,
        content_id,
        "submit",
    )


# =====================================================
# 9. APPROVE CONTENT
# ADMIN / REVIEWER
# =====================================================

@router.post(
    "/content/{content_id}/approve",
    response_model=ContentRead,
)
def approve_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _transition_content(
        db,
        user,
        content_id,
        "approve",
    )


# =====================================================
# 10. REJECT CONTENT
# ADMIN / REVIEWER
# =====================================================

@router.post(
    "/content/{content_id}/reject",
    response_model=ContentRead,
)
def reject_content(
    content_id: UUID,
    request: ContentRejectionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not request.feedback or not request.feedback.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rejection feedback is required",
        )
    return _transition_content(
        db,
        user,
        content_id,
        "reject",
    )


# =====================================================
# 11. CREATE SOCIAL ACCOUNT
# ADMIN ONLY
# =====================================================

@router.post(
    "/social-accounts",
    response_model=SocialAccountRead,
    status_code=status.HTTP_201_CREATED,
)
def create_social_account(
    request: SocialAccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(
        db,
        user,
        request.company_id,
        allowed_roles=("admin",),
    )

    duplicate = db.scalar(
        select(DimSocialAccount).where(
            DimSocialAccount.platform
            == request.platform,

            DimSocialAccount.external_account_id
            == request.external_account_id,
        )
    )

    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail="Social account already exists",
        )

    account = DimSocialAccount(
        **request.model_dump(),
        connection_status="disconnected",
    )

    db.add(account)

    try:
        db.commit()
        db.refresh(account)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Social account already exists",
        ) from None

    return account


# =====================================================
# 12. LIST SOCIAL ACCOUNTS
# ALL ROLES
# =====================================================

@router.get(
    "/social-accounts",
    response_model=SocialAccountListResponse,
)
def list_social_accounts(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(
        db,
        user,
        company_id,
    )

    total = db.scalar(
        select(func.count())
        .select_from(DimSocialAccount)
        .where(
            DimSocialAccount.company_id == company_id
        )
    ) or 0

    items = db.scalars(
        select(DimSocialAccount)
        .where(
            DimSocialAccount.company_id == company_id
        )
        .order_by(
            DimSocialAccount.platform
        )
    ).all()

    return {
        "total": total,
        "items": items,
    }


# =====================================================
# 13. GET SOCIAL ACCOUNT
# ALL ROLES
# =====================================================

@router.get(
    "/social-accounts/{account_id}",
    response_model=SocialAccountRead,
)
def get_social_account(
    account_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _authorized_social_account(
        db,
        user,
        account_id,
    )


# =====================================================
# 14. UPDATE SOCIAL ACCOUNT
# ADMIN ONLY
# =====================================================

@router.patch(
    "/social-accounts/{account_id}",
    response_model=SocialAccountRead,
)
def edit_social_account(
    account_id: UUID,
    request: SocialAccountUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = _authorized_social_account(
        db,
        user,
        account_id,
    )

    ensure_company_access(
        db,
        user,
        account.company_id,
        allowed_roles=("admin",),
    )

    updated_account = crud.update_social_account(
        db,
        account.company_id,
        account_id,
        **request.model_dump(
            exclude_unset=True
        ),
    )

    if updated_account is None:
        raise HTTPException(
            status_code=404,
            detail="Social account not found",
        )

    return updated_account


# =====================================================
# 15. DELETE SOCIAL ACCOUNT
# ADMIN ONLY
# =====================================================

@router.delete(
    "/social-accounts/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_social_account(
    account_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = _authorized_social_account(
        db,
        user,
        account_id,
    )

    ensure_company_access(
        db,
        user,
        account.company_id,
        allowed_roles=("admin",),
    )

    try:
        deleted = crud.delete_social_account(
            db,
            account.company_id,
            account_id,
        )

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Social account has performance history",
        ) from None

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Social account not found",
        )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT
    )


# =====================================================
# 16. LIST MARKETING PERFORMANCE
# ALL ROLES
# =====================================================

@router.get(
    "/performance",
    response_model=PerformanceListResponse,
)
def list_performance(
    company_id: UUID,
    content_id: UUID | None = None,
    social_account_id: UUID | None = None,

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
    ensure_company_access(
        db,
        user,
        company_id,
    )

    filters = [
        FactMarketingPerformance.company_id
        == company_id
    ]

    if content_id is not None:
        filters.append(
            FactMarketingPerformance.content_id
            == content_id
        )

    if social_account_id is not None:
        filters.append(
            FactMarketingPerformance.social_account_id
            == social_account_id
        )

    total = db.scalar(
        select(func.count())
        .select_from(FactMarketingPerformance)
        .where(*filters)
    ) or 0

    items = db.scalars(
        select(FactMarketingPerformance)
        .where(*filters)
        .order_by(
            FactMarketingPerformance.collected_at.desc()
        )
        .limit(limit)
        .offset(offset)
    ).all()

    return {
        "total": total,
        "items": items,
    }


# =====================================================
# 17. GET PERFORMANCE RECORD
# ALL ROLES
# =====================================================

@router.get(
    "/performance/{performance_id}",
    response_model=PerformanceRead,
)
def get_performance(
    performance_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.get(
        FactMarketingPerformance,
        performance_id,
    )

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Performance snapshot not found",
        )

    ensure_company_access(
        db,
        user,
        record.company_id,
    )

    return record


# =====================================================
# 18. GET LATEST POST PERFORMANCE
# ALL ROLES
# =====================================================

@router.get(
    "/posts/{published_post_id}/performance/latest",
    response_model=PerformanceRead,
)
def get_latest_performance(
    published_post_id: UUID,

    metric_period: str = Query(
        default="lifetime",
        pattern="^(daily|lifetime)$",
    ),

    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Find the latest performance record belonging
    to the authenticated user's company.

    Does not use CompanyMembership.
    """

    if user.company_id is None:
        raise HTTPException(
            status_code=403,
            detail="Company onboarding required",
        )

    record = db.scalar(
        select(FactMarketingPerformance)
        .where(
            FactMarketingPerformance.published_post_id
            == published_post_id,

            FactMarketingPerformance.metric_period
            == metric_period,

            FactMarketingPerformance.company_id
            == user.company_id,
        )
        .order_by(
            FactMarketingPerformance.collected_at.desc()
        )
        .limit(1)
    )

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="Performance snapshot not found",
        )

    return record


# =====================================================
# 19. CREATE MARKETING PERFORMANCE
# ADMIN ONLY
# =====================================================

@router.post(
    "/performance",
    response_model=PerformanceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_performance(
    request: PerformanceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(
        db,
        user,
        request.company_id,
        allowed_roles=("admin",),
    )

    values = request.model_dump(
        exclude={
            "company_id",
            "content_id",
            "social_account_id",
            "published_post_id",
            "collected_at",
            "metric_period",
            "metric_source",
        }
    )

    try:
        return crud.create_marketing_performance(
            db,
            company_id=request.company_id,
            content_id=request.content_id,
            social_account_id=request.social_account_id,
            published_post_id=request.published_post_id,
            collected_at=request.collected_at,
            metric_period=request.metric_period,
            metric_source=request.metric_source,
            **values,
        )

    except ValueError as exc:
        db.rollback()

        message = str(exc)

        if "already exists" in message:
            error_code = 409
        elif "not found" in message:
            error_code = 404
        else:
            error_code = 422

        raise HTTPException(
            status_code=error_code,
            detail=message,
        ) from exc

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Duplicate or invalid "
                "performance snapshot"
            ),
        ) from None
