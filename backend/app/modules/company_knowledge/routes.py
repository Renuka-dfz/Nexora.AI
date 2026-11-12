from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
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
from app.modules.identity.models import CompanyMembership, User

router = APIRouter(tags=["Company Intelligence"])


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
    values = request.model_dump()
    if values["website_url"] is not None:
        values["website_url"] = str(values["website_url"])
    company = DimCompany(**values)
    db.add(company)
    db.flush()
    db.add(
        CompanyMembership(
            company_id=company.company_id,
            user_id=user.user_id,
            role="owner",
        )
    )
    db.commit()
    db.refresh(company)
    return company


@router.get("/companies/{company_id}", response_model=CompanyRead)
def get_company(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    company = crud.get_company(db, company_id)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return company


@router.patch("/companies/{company_id}", response_model=CompanyRead)
def update_company(
    company_id: UUID,
    request: CompanyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    updates = request.model_dump(exclude_unset=True)
    if updates.get("website_url") is not None:
        updates["website_url"] = str(updates["website_url"])

    company = crud.update_company(db, company_id, updates)
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return company


@router.get(
    "/companies/{company_id}/knowledge/categories",
    response_model=CategoryListResponse,
)
def list_categories(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    categories = crud.get_categories(db)
    return {"total": len(categories), "items": categories}


@router.get("/categories", response_model=CategoryListResponse)
def list_all_categories(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    categories = crud.get_categories(db)
    return {"total": len(categories), "items": categories}


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
    ensure_company_access(db, user, company_id)
    source_url = str(request.source_url)
    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_url == source_url,
        )
    )
    if source is not None:
        raise HTTPException(status_code=409, detail="Source URL already exists")
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
        raise HTTPException(status_code=409, detail="Source URL already exists") from None
    return source


@router.get(
    "/companies/{company_id}/sources", response_model=SourceListResponse
)
def list_sources(
    company_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    sources = db.scalars(
        select(DimSource)
        .where(DimSource.company_id == company_id)
        .order_by(DimSource.source_url)
    ).all()
    return {"company_id": company_id, "total": len(sources), "items": sources}


@router.get(
    "/companies/{company_id}/sources/{source_id}", response_model=SourceRead
)
def get_source(
    company_id: UUID,
    source_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_id == source_id,
        )
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.get(
    "/companies/{company_id}/knowledge",
    response_model=KnowledgeListResponse,
)
def list_company_knowledge(
    company_id: UUID,
    category_id: int | None = Query(default=None, gt=0),
    verification_status: str | None = Query(
        default=None, pattern="^(pending|verified|rejected|conflicting)$"
    ),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    if category_id is not None and crud.get_category(db, category_id) is None:
        raise HTTPException(status_code=422, detail="Unknown category_id")
    filters = [FactCompanyIntelligence.company_id == company_id]
    if category_id is not None:
        filters.append(FactCompanyIntelligence.category_id == category_id)
    if verification_status is not None:
        filters.append(
            FactCompanyIntelligence.verification_status == verification_status
        )
    total = db.scalar(
        select(func.count())
        .select_from(FactCompanyIntelligence)
        .where(*filters)
    ) or 0
    items = db.scalars(
        select(FactCompanyIntelligence)
        .where(*filters)
        .order_by(FactCompanyIntelligence.extracted_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"company_id": company_id, "total": total, "items": items}


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
    ensure_company_access(db, user, company_id)
    if crud.get_category(db, request.category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Unknown category_id",
        )

    source = db.scalar(
        select(DimSource).where(
            DimSource.company_id == company_id,
            DimSource.source_id == request.source_id,
        )
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return crud.create_company_information(
        db,
        company_id=company_id,
        category_id=request.category_id,
        source_id=source.source_id,
        title=request.title,
        description=request.description,
    )


@router.get(
    "/companies/{company_id}/knowledge/{fact_id}", response_model=KnowledgeRead
)
def get_company_knowledge(
    company_id: UUID,
    fact_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    fact = db.scalar(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.company_id == company_id,
            FactCompanyIntelligence.fact_id == fact_id,
        )
    )
    if fact is None:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    return fact


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
    ensure_company_access(db, user, company_id)
    fact = crud.update_company_information(
        db,
        company_id,
        fact_id,
        request.model_dump(exclude_unset=True),
    )
    if fact is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge item not found",
        )
    return fact


@router.patch(
    "/companies/{company_id}/knowledge/{fact_id}/verification",
    response_model=KnowledgeRead,
)
def verify_company_knowledge(
    company_id: UUID,
    fact_id: UUID,
    request: KnowledgeVerificationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    fact = db.scalar(
        select(FactCompanyIntelligence).where(
            FactCompanyIntelligence.company_id == company_id,
            FactCompanyIntelligence.fact_id == fact_id,
        )
    )
    if fact is None:
        raise HTTPException(status_code=404, detail="Knowledge item not found")
    fact.verification_status = request.verification_status
    db.commit()
    db.refresh(fact)
    return fact


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
    ensure_company_access(db, user, company_id)
    if not crud.delete_company_information(db, company_id, fact_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge item not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
