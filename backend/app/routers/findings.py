from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company, ProtectedAsset, Candidate, RiskFinding
from app.schemas import (
    RiskFindingCreate,
    RiskFindingUpdate,
    RiskFindingResponse,
)
from app.services.risk_scoring import recalculate_company_risk, calculate_finding_score

router = APIRouter(prefix="/findings", tags=["Findings"])


@router.get("", response_model=List[RiskFindingResponse], include_in_schema=False)
@router.get("/", response_model=List[RiskFindingResponse])
def list_findings(
    response: Response,
    company_id: Optional[int] = Query(None, description="Filter findings by company ID"),
    severity: Optional[str] = Query(None, description="Filter by severity (low, medium, high, critical)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (pending, completed, failed)"),
    asset_id: Optional[int] = Query(None, description="Filter by asset ID"),
    candidate_id: Optional[int] = Query(None, description="Filter by candidate signal ID"),
    search: Optional[str] = Query(None, description="Search term matching title or description"),
    min_risk_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Filter findings with risk score >= min_risk_score"),
    max_risk_score: Optional[float] = Query(None, ge=0.0, le=100.0, description="Filter findings with risk score <= max_risk_score"),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Page limit for pagination"),
    page: Optional[int] = Query(None, ge=1, description="Page number (1-based index)"),
    page_size: Optional[int] = Query(None, ge=1, le=1000, description="Items per page"),
    db: Session = Depends(get_db),
):
    """List validated risk findings with pagination and optional filtering."""
    query = db.query(RiskFinding)
    if company_id is not None:
        query = query.filter(RiskFinding.company_id == company_id)
    if severity:
        query = query.filter(func.lower(RiskFinding.severity) == severity.lower())
    if status_filter:
        query = query.filter(func.lower(RiskFinding.status) == status_filter.lower())
    if asset_id is not None:
        query = query.filter(RiskFinding.asset_id == asset_id)
    if candidate_id is not None:
        query = query.filter(RiskFinding.candidate_id == candidate_id)
    if min_risk_score is not None:
        query = query.filter(RiskFinding.risk_score >= min_risk_score)
    if max_risk_score is not None:
        query = query.filter(RiskFinding.risk_score <= max_risk_score)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (RiskFinding.title.ilike(search_term)) | (RiskFinding.description.ilike(search_term))
        )

    total_count = query.count()

    actual_limit = page_size if page_size is not None else limit
    if page is not None:
        actual_skip = (page - 1) * actual_limit
        current_page = page
    else:
        actual_skip = skip
        current_page = (actual_skip // actual_limit) + 1

    total_pages = max(1, (total_count + actual_limit - 1) // actual_limit) if total_count > 0 else 1

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Page"] = str(current_page)
    response.headers["X-Limit"] = str(actual_limit)
    response.headers["X-Total-Pages"] = str(total_pages)

    return query.order_by(RiskFinding.created_at.desc()).offset(actual_skip).limit(actual_limit).all()


@router.post("", response_model=RiskFindingResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=RiskFindingResponse, status_code=status.HTTP_201_CREATED)
def create_finding(
    finding_in: RiskFindingCreate,
    db: Session = Depends(get_db),
):
    """Create a verified security finding and update the company's risk score."""
    company = db.query(Company).filter(Company.id == finding_in.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {finding_in.company_id} does not exist.",
        )
    if finding_in.candidate_id:
        candidate = db.query(Candidate).filter(Candidate.id == finding_in.candidate_id).first()
        if not candidate:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Candidate with ID {finding_in.candidate_id} does not exist.",
            )
    asset_crit = "MEDIUM"
    if finding_in.asset_id:
        asset = db.query(ProtectedAsset).filter(ProtectedAsset.id == finding_in.asset_id).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID {finding_in.asset_id} does not exist.",
            )
        asset_crit = asset.criticality

    data = finding_in.model_dump()
    data["severity"] = data["severity"].lower()
    data["status"] = data["status"].lower()

    # Calculate default risk score if left unset
    if not data.get("risk_score") and data.get("risk_score") != 0.0:
        data["risk_score"] = calculate_finding_score(data["severity"], asset_crit)

    finding = RiskFinding(**data)
    db.add(finding)
    db.commit()
    db.refresh(finding)

    # Recalculate company risk posture
    recalculate_company_risk(finding.company_id, db)

    return finding


@router.get("/{finding_id}", response_model=RiskFindingResponse)
def get_finding(
    finding_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve details for a single finding."""
    finding = db.query(RiskFinding).filter(RiskFinding.id == finding_id).first()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding with ID {finding_id} not found.",
        )
    return finding


@router.put("/{finding_id}", response_model=RiskFindingResponse)
def update_finding(
    finding_id: int,
    finding_in: RiskFindingUpdate,
    db: Session = Depends(get_db),
):
    """Update finding status, severity, or remediation guidance."""
    finding = db.query(RiskFinding).filter(RiskFinding.id == finding_id).first()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding with ID {finding_id} not found.",
        )
    update_data = finding_in.model_dump(exclude_unset=True)
    if "severity" in update_data and update_data["severity"]:
        update_data["severity"] = update_data["severity"].lower()
    if "status" in update_data and update_data["status"]:
        update_data["status"] = update_data["status"].lower()

    for field, value in update_data.items():
        setattr(finding, field, value)
    db.commit()
    db.refresh(finding)

    # Recalculate company risk posture
    recalculate_company_risk(finding.company_id, db)

    return finding


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_finding(
    finding_id: int,
    db: Session = Depends(get_db),
):
    """Delete a finding."""
    finding = db.query(RiskFinding).filter(RiskFinding.id == finding_id).first()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding with ID {finding_id} not found.",
        )
    company_id = finding.company_id
    db.delete(finding)
    db.commit()

    # Recalculate company risk posture
    recalculate_company_risk(company_id, db)

    return None
