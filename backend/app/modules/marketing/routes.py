from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
from app.modules.identity.models import CompanyMembership, User
from app.modules.marketing import crud
from app.modules.marketing.models import (
    DimContent,
    DimSocialAccount,
    FactMarketingPerformance,
)
from app.modules.marketing.schemas import (
    ContentCreate,
    ContentListResponse,
    ContentRead,
    ContentUpdate,
    PerformanceCreate,
    PerformanceListResponse,
    PerformanceRead,
    SocialAccountCreate,
    SocialAccountListResponse,
    SocialAccountRead,
    SocialAccountUpdate,
)

router = APIRouter(prefix="/marketing", tags=["Marketing"])


def _authorized_content(db: Session, user: User, content_id: UUID) -> DimContent:
    content = db.get(DimContent, content_id)
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")
    ensure_company_access(db, user, content.company_id)
    return content


def _authorized_social_account(
    db: Session, user: User, account_id: UUID
) -> DimSocialAccount:
    account = db.get(DimSocialAccount, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Social account not found")
    ensure_company_access(db, user, account.company_id)
    return account


@router.post("/content", response_model=ContentRead, status_code=201)
def create_content(
    request: ContentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, request.company_id)
    return crud.create_content(
        db, **request.model_dump(exclude={"company_id"}), company_id=request.company_id
    )


@router.get("/content", response_model=ContentListResponse)
def list_content(
    company_id: UUID,
    platform: str | None = Query(default=None, min_length=1, max_length=30),
    status_filter: str | None = Query(
        default=None, alias="status", pattern="^(draft|pending|approved|rejected)$"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    filters = [DimContent.company_id == company_id]
    if status_filter is not None:
        filters.append(DimContent.approval_status == status_filter)
    if platform is not None:
        filters.append(DimContent.platform_target == platform)
    total = db.scalar(
        select(func.count()).select_from(DimContent).where(*filters)
    ) or 0
    items = db.scalars(
        select(DimContent)
        .where(*filters)
        .order_by(DimContent.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"total": total, "items": items}


@router.get("/content/{content_id}", response_model=ContentRead)
def get_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _authorized_content(db, user, content_id)


@router.patch("/content/{content_id}", response_model=ContentRead)
def edit_content(
    content_id: UUID,
    request: ContentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = _authorized_content(db, user, content_id)
    try:
        content = crud.update_content(
            db,
            content.company_id,
            content_id,
            **request.model_dump(exclude_unset=True),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if content is None:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.delete("/content/{content_id}", status_code=204)
def remove_content(
    content_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = _authorized_content(db, user, content_id)
    try:
        deleted = crud.delete_content(db, content.company_id, content_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Content not found")
    return Response(status_code=204)


def _transition_content(
    db: Session, user: User, content_id: UUID, action: str
) -> DimContent:
    content = _authorized_content(db, user, content_id)
    allowed = {
        "submit": {"draft", "rejected"},
        "approve": {"pending"},
        "reject": {"pending"},
    }
    if content.approval_status not in allowed[action]:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot {action} content with status '{content.approval_status}'",
        )
    content.approval_status = {
        "submit": "pending", "approve": "approved", "reject": "rejected"
    }[action]
    db.commit()
    db.refresh(content)
    return content


@router.post("/content/{content_id}/submit", response_model=ContentRead)
def submit_content(
    content_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _transition_content(db, user, content_id, "submit")


@router.post("/content/{content_id}/approve", response_model=ContentRead)
def approve_content(
    content_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _transition_content(db, user, content_id, "approve")


@router.post("/content/{content_id}/reject", response_model=ContentRead)
def reject_content(
    content_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _transition_content(db, user, content_id, "reject")


@router.post("/social-accounts", response_model=SocialAccountRead, status_code=201)
def create_social_account(
    request: SocialAccountCreate, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, request.company_id)
    duplicate = db.scalar(
        select(DimSocialAccount).where(
            DimSocialAccount.platform == request.platform,
            DimSocialAccount.external_account_id == request.external_account_id,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Social account already exists")
    account = DimSocialAccount(**request.model_dump(), connection_status="disconnected")
    db.add(account)
    try:
        db.commit()
        db.refresh(account)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Social account already exists") from None
    return account


@router.get("/social-accounts", response_model=SocialAccountListResponse)
def list_social_accounts(
    company_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    stmt = select(DimSocialAccount).where(
        DimSocialAccount.company_id == company_id
    )
    total = db.scalar(
        select(func.count())
        .select_from(DimSocialAccount)
        .where(DimSocialAccount.company_id == company_id)
    ) or 0
    items = db.scalars(
        stmt.order_by(DimSocialAccount.platform)
    ).all()
    return {"total": total, "items": items}


@router.get("/social-accounts/{account_id}", response_model=SocialAccountRead)
def get_social_account(
    account_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _authorized_social_account(db, user, account_id)


@router.patch("/social-accounts/{account_id}", response_model=SocialAccountRead)
def edit_social_account(
    account_id: UUID, request: SocialAccountUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    account = _authorized_social_account(db, user, account_id)
    updates = request.model_dump(exclude_unset=True)
    account = crud.update_social_account(
        db, account.company_id, account_id, **updates
    )
    if account is None:
        raise HTTPException(status_code=404, detail="Social account not found")
    return account


@router.delete("/social-accounts/{account_id}", status_code=204)
def remove_social_account(
    account_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = _authorized_social_account(db, user, account_id)
    try:
        deleted = crud.delete_social_account(db, account.company_id, account_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Social account has performance history") from None
    if not deleted:
        raise HTTPException(status_code=404, detail="Social account not found")
    return Response(status_code=204)


@router.get("/performance", response_model=PerformanceListResponse)
def list_performance(
    company_id: UUID,
    content_id: UUID | None = None,
    social_account_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    filters = [FactMarketingPerformance.company_id == company_id]
    if content_id is not None:
        filters.append(FactMarketingPerformance.content_id == content_id)
    if social_account_id is not None:
        filters.append(
            FactMarketingPerformance.social_account_id == social_account_id
        )
    total = db.scalar(
        select(func.count())
        .select_from(FactMarketingPerformance)
        .where(*filters)
    ) or 0
    items = db.scalars(
        select(FactMarketingPerformance)
        .where(*filters)
        .order_by(FactMarketingPerformance.collected_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"total": total, "items": items}


@router.get("/performance/{performance_id}", response_model=PerformanceRead)
def get_performance(
    performance_id: UUID,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    record = db.get(FactMarketingPerformance, performance_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Performance snapshot not found")
    ensure_company_access(db, user, record.company_id)
    return record


@router.get(
    "/posts/{published_post_id}/performance/latest",
    response_model=PerformanceRead,
)
def get_latest_performance(
    published_post_id: UUID,
    metric_period: str = Query(default="lifetime", pattern="^(daily|lifetime)$"),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    record = db.scalar(
        select(FactMarketingPerformance)
        .join(
            CompanyMembership,
            CompanyMembership.company_id == FactMarketingPerformance.company_id,
        )
        .where(
            FactMarketingPerformance.published_post_id == published_post_id,
            FactMarketingPerformance.metric_period == metric_period,
            CompanyMembership.user_id == user.user_id,
        )
        .order_by(FactMarketingPerformance.collected_at.desc())
        .limit(1)
    )
    if record is None:
        exists = db.scalar(
            select(FactMarketingPerformance.performance_id)
            .where(
                FactMarketingPerformance.published_post_id == published_post_id,
                FactMarketingPerformance.metric_period == metric_period,
            )
            .limit(1)
        )
        if exists is None:
            raise HTTPException(status_code=404, detail="Performance snapshot not found")
        raise HTTPException(status_code=403, detail="Not a member of this company")
    return record


@router.post("/performance", response_model=PerformanceRead, status_code=201)
def create_performance(
    request: PerformanceCreate, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, request.company_id)
    values = request.model_dump(exclude={
        "company_id", "content_id", "social_account_id", "published_post_id",
        "collected_at", "metric_period", "metric_source",
    })
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
        code = 409 if "already exists" in message else 404 if "not found" in message else 422
        raise HTTPException(status_code=code, detail=message) from exc
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate or invalid performance snapshot") from None
