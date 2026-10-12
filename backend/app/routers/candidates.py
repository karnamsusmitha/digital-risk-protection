from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company, ProtectedAsset, Candidate, RiskFinding
from app.schemas import (
    CandidateCreate,
    CandidateUpdate,
    CandidateResponse,
    RiskFindingResponse,
)
from app.services.risk_scoring import evaluate_candidate_signal, recalculate_company_risk

router = APIRouter(prefix="/candidates", tags=["Candidates"])


@router.get("", response_model=List[CandidateResponse], include_in_schema=False)
@router.get("/", response_model=List[CandidateResponse])
def list_candidates(
    company_id: Optional[int] = Query(None, description="Filter candidates by company ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (pending, etc.)"),
    source: Optional[str] = Query(None, description="Filter by detection source"),
    candidate_type: Optional[str] = Query(None, description="Filter by candidate type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """List threat intelligence candidates/signals."""
    query = db.query(Candidate)
    if company_id is not None:
        query = query.filter(Candidate.company_id == company_id)
    if status_filter:
        query = query.filter(func.lower(Candidate.status) == status_filter.lower())
    if source:
        query = query.filter(Candidate.source == source)
    if candidate_type:
        query = query.filter(func.lower(Candidate.asset_type) == candidate_type.lower())
    return query.offset(skip).limit(limit).all()


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
def create_candidate(
    candidate_in: CandidateCreate,
    db: Session = Depends(get_db),
):
    """Ingest a new threat candidate signal from monitoring scanners or AI."""
    if candidate_in.company_id:
        company = db.query(Company).filter(Company.id == candidate_in.company_id).first()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company with ID {candidate_in.company_id} does not exist.",
            )
    if candidate_in.asset_id:
        asset = db.query(ProtectedAsset).filter(ProtectedAsset.id == candidate_in.asset_id).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID {candidate_in.asset_id} does not exist.",
            )

    data = candidate_in.model_dump(exclude_unset=True)
    if "status" in data and data["status"]:
        data["status"] = data["status"].lower()
    if "asset_type" in data and data["asset_type"]:
        data["asset_type"] = data["asset_type"].lower()
    candidate = Candidate(**data)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific threat candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID {candidate_id} not found.",
        )
    return candidate


@router.put("/{candidate_id}", response_model=CandidateResponse)
def update_candidate(
    candidate_id: int,
    candidate_in: CandidateUpdate,
    db: Session = Depends(get_db),
):
    """Update status or score of a threat candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID {candidate_id} not found.",
        )
    update_data = candidate_in.model_dump(exclude_unset=True)
    if "status" in update_data and update_data["status"]:
        update_data["status"] = update_data["status"].lower()
    for field, value in update_data.items():
        setattr(candidate, field, value)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.post("/{candidate_id}/convert-to-finding", response_model=RiskFindingResponse, status_code=status.HTTP_201_CREATED)
def convert_candidate_to_finding(
    candidate_id: int,
    db: Session = Depends(get_db),
):
    """
    Automated triage action: Promotes a threat signal candidate to a verified active Finding,
    evaluating severity and risk score, and updating the company's risk posture.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID {candidate_id} not found.",
        )
    if not candidate.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot convert candidate to finding: no associated company_id on candidate.",
        )

    # Perform risk assessment
    evaluation = evaluate_candidate_signal(
        candidate_type=candidate.candidate_type or candidate.asset_type,
        source=candidate.source or "SCANNER",
        raw_data=candidate.raw_data or candidate.value,
    )

    finding = RiskFinding(
        company_id=candidate.company_id,
        asset_id=candidate.asset_id,
        candidate_id=candidate.id,
        title=f"Verified Risk: {candidate.candidate_type or candidate.asset_type} from {candidate.source or 'SCANNER'}",
        description=f"{evaluation.rationale} Details: {candidate.value}",
        severity=evaluation.recommended_severity.lower(),
        status="pending",
        risk_score=evaluation.estimated_risk_score,
        reasons=[evaluation.rationale],
        evidence={"source": candidate.source, "raw_data": candidate.raw_data, "value": candidate.value},
        remediation_guidance=evaluation.recommended_remediation,
    )

    candidate.status = "completed"
    db.add(finding)
    db.commit()
    db.refresh(finding)

    # Recalculate company risk
    recalculate_company_risk(candidate.company_id, db)

    return finding


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
):
    """Delete a threat candidate."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate with ID {candidate_id} not found.",
        )
    db.delete(candidate)
    db.commit()
    return None
