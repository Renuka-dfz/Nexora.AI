from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import ensure_company_access, get_current_user
from app.modules.identity.models import User
from app.modules.lead_management import crud
from app.modules.lead_management.models import (
    DimLead,
    DimLeadSource,
    FactLeadQualification,
)
from app.modules.lead_management.schemas import (
    LeadCreate,
    LeadListResponse,
    LeadRead,
    LeadSourceCreate,
    LeadSourceListResponse,
    LeadSourceRead,
    LeadSourceUpdate,
    LeadUpdate,
    QualificationCreate,
    QualificationHistoryResponse,
    QualificationRead,
    QualificationUpdate,
)
from app.modules.marketing.crud import get_or_create_date

router = APIRouter(tags=["Lead Management"])


def _authorized_lead(db: Session, user: User, lead_id: UUID) -> DimLead:
    lead = db.get(DimLead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    ensure_company_access(db, user, lead.company_id)
    return lead


@router.post("/leads", response_model=LeadRead, status_code=201)
def create_lead(
    request: LeadCreate, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, request.company_id)
    values = request.model_dump(exclude={"company_id"})
    if values["email"] is not None:
        values["email"] = str(values["email"]).lower()
    return crud.create_lead(db, company_id=request.company_id, **values)


@router.get("/leads", response_model=LeadListResponse)
def list_leads(
    company_id: UUID,
    lead_status: str | None = Query(
        default=None, pattern="^(active|inactive|converted)$"
    ),
    industry: str | None = Query(default=None, max_length=150),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    filters = [DimLead.company_id == company_id]
    if lead_status:
        filters.append(DimLead.lead_status == lead_status)
    if industry:
        filters.append(DimLead.industry == industry)
    total = db.scalar(
        select(func.count()).select_from(DimLead).where(*filters)
    ) or 0
    items = db.scalars(
        select(DimLead)
        .where(*filters)
        .order_by(DimLead.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return {"total": total, "items": items}


@router.get("/leads/{lead_id}", response_model=LeadRead)
def get_lead(
    lead_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _authorized_lead(db, user, lead_id)


@router.patch("/leads/{lead_id}", response_model=LeadRead)
def edit_lead(
    lead_id: UUID, request: LeadUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    lead = _authorized_lead(db, user, lead_id)
    values = request.model_dump(exclude_unset=True)
    if "email" in values and values["email"] is not None:
        values["email"] = str(values["email"]).lower()
    return crud.update_lead(db, lead.company_id, lead_id, **values)


@router.delete("/leads/{lead_id}", status_code=204)
def remove_lead(
    lead_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _authorized_lead(db, user, lead_id)
    try:
        crud.delete_lead(db, lead.company_id, lead_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Lead has qualification history and cannot be deleted"
        ) from None
    return Response(status_code=204)


@router.post("/lead-sources", response_model=LeadSourceRead, status_code=201)
def create_lead_source(
    request: LeadSourceCreate, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, request.company_id)
    return crud.create_lead_source(
        db, **request.model_dump(exclude={"company_id"}),
        company_id=request.company_id,
    )


@router.get("/lead-sources", response_model=LeadSourceListResponse)
def list_lead_sources(
    company_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_company_access(db, user, company_id)
    items = crud.list_lead_sources(db, company_id)
    return {"total": len(items), "items": items}


@router.patch("/lead-sources/{source_id}", response_model=LeadSourceRead)
def edit_lead_source(
    source_id: UUID, request: LeadSourceUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    source = db.get(DimLeadSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Lead source not found")
    ensure_company_access(db, user, source.company_id)
    source = crud.update_lead_source(
        db, source.company_id, source_id,
        **request.model_dump(exclude_unset=True),
    )
    if source is None:
        raise HTTPException(status_code=404, detail="Lead source not found")
    return source


@router.delete("/lead-sources/{source_id}", status_code=204)
def remove_lead_source(
    source_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    source = db.get(DimLeadSource, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Lead source not found")
    ensure_company_access(db, user, source.company_id)
    try:
        deleted = crud.delete_lead_source(db, source.company_id, source_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Lead source has qualification history"
        ) from None
    if not deleted:
        raise HTTPException(status_code=404, detail="Lead source not found")
    return Response(status_code=204)


@router.post(
    "/leads/{lead_id}/qualifications",
    response_model=QualificationRead,
    status_code=201,
)
def create_qualification(
    lead_id: UUID, request: QualificationCreate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    lead = _authorized_lead(db, user, lead_id)
    if request.source_id is not None and crud.get_lead_source(
        db, lead.company_id, request.source_id
    ) is None:
        raise HTTPException(status_code=404, detail="Lead source not found")
    date_id = get_or_create_date(db, datetime.now(timezone.utc).date()).date_id
    try:
        return crud.create_lead_qualification(
            db, company_id=lead.company_id, lead_id=lead_id,
            date_id=date_id, **request.model_dump(),
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get(
    "/leads/{lead_id}/qualifications",
    response_model=QualificationHistoryResponse,
)
def qualification_history(
    lead_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _authorized_lead(db, user, lead_id)
    items = crud.get_lead_qualification_history(db, lead.company_id, lead_id)
    return {"lead_id": lead_id, "total": len(items), "items": items}


@router.get(
    "/leads/{lead_id}/qualifications/latest", response_model=QualificationRead
)
def latest_qualification(
    lead_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lead = _authorized_lead(db, user, lead_id)
    record = crud.get_latest_lead_qualification(db, lead.company_id, lead_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Qualification not found")
    return record


def _authorized_qualification(
    db: Session, user: User, qualification_id: UUID
) -> FactLeadQualification:
    record = db.get(FactLeadQualification, qualification_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Qualification not found")
    ensure_company_access(db, user, record.company_id)
    return record


@router.get(
    "/lead-qualifications/{qualification_id}", response_model=QualificationRead
)
def get_qualification(
    qualification_id: UUID, user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _authorized_qualification(db, user, qualification_id)


@router.patch(
    "/lead-qualifications/{qualification_id}", response_model=QualificationRead
)
def edit_qualification(
    qualification_id: UUID, request: QualificationUpdate,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    record = _authorized_qualification(db, user, qualification_id)
    return crud.update_lead_qualification(
        db, record.company_id, qualification_id,
        **request.model_dump(exclude_unset=True),
    )
