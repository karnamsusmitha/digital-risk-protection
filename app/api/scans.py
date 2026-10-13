from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Scan, Brand
from app.schemas import (
    ScanRequest,
    ScanResponse,
    ScanStatusUpdate,
    RiskCategory,
    ScanStatus,
    CandidateType
)
from app.services.detection.adapter import detection_service
from app.services.detection.interface import DetectionContext

router = APIRouter(prefix="/api/scans", tags=["Scans"])


def _to_scan_response(scan: Scan) -> ScanResponse:
    """Helper to convert ORM Scan model into ScanResponse schema."""
    brand_name = scan.brand.name if scan.brand else None
    return ScanResponse(
        id=scan.id,
        brand_id=scan.brand_id,
        brand_name=brand_name,
        candidate_type=scan.candidate_type,
        candidate_value=scan.candidate_value,
        normalized_value=scan.normalized_value,
        risk_score=scan.risk_score,
        risk_category=scan.risk_category,
        status=scan.status,
        indicators=scan.indicators,
        engine_used=scan.engine_used,
        disclaimer=scan.disclaimer,
        created_at=scan.created_at,
        recommended_action=getattr(scan, "recommended_action", None),
        evidence_source=getattr(scan, "evidence_source", None),
        explanations=getattr(scan, "explanations", None)
    )


@router.post("", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
def create_scan(scan_in: ScanRequest, db: Session = Depends(get_db)):
    """
    Submit a candidate domain, URL, social profile, or mobile app for risk analysis.
    Transparently evaluates risk score, category, and indicators using explainable rules.
    """
    context: Optional[DetectionContext] = None
    brand: Optional[Brand] = None

    if scan_in.brand_id is not None:
        brand = db.query(Brand).filter(Brand.id == scan_in.brand_id).first()
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Associated Brand ID {scan_in.brand_id} not found."
            )
        context = DetectionContext(
            brand_id=brand.id,
            brand_name=brand.name,
            official_domains=brand.official_domains or [],
            official_urls=brand.official_urls or [],
            official_social_handles=brand.official_social_handles or []
        )

    evidence_dict = scan_in.evidence.model_dump() if scan_in.evidence else None

    try:
        detection_result = detection_service.analyze(
            candidate_type=scan_in.candidate_type.value,
            candidate_value=scan_in.candidate_value,
            context=context,
            evidence=evidence_dict
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Input validation error: {str(e)}"
        )

    # Initial triage status based on risk level
    initial_status = "review_needed" if detection_result.risk_category in ("High", "Critical") else "completed"

    scan_record = Scan(
        brand_id=brand.id if brand else None,
        candidate_type=scan_in.candidate_type.value,
        candidate_value=scan_in.candidate_value.strip(),
        normalized_value=detection_result.normalized_value,
        risk_score=detection_result.risk_score,
        risk_category=detection_result.risk_category,
        status=initial_status,
        indicators=detection_result.indicators,
        engine_used=detection_result.engine_used,
        disclaimer=detection_result.disclaimer,
        recommended_action=detection_result.recommended_action,
        evidence_source=detection_result.evidence_source,
        explanations=detection_result.explanations
    )

    db.add(scan_record)
    db.commit()
    db.refresh(scan_record)

    return _to_scan_response(scan_record)


@router.get("", response_model=List[ScanResponse])
def list_scans(
    brand_id: Optional[int] = None,
    category: Optional[RiskCategory] = None,
    status_filter: Optional[ScanStatus] = Query(None, alias="status"),
    candidate_type: Optional[CandidateType] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve scan history with filtering by brand, risk category, status, and candidate type.
    """
    query = db.query(Scan)

    if brand_id is not None:
        query = query.filter(Scan.brand_id == brand_id)
    if category is not None:
        query = query.filter(Scan.risk_category == category.value)
    if status_filter is not None:
        query = query.filter(Scan.status == status_filter.value)
    if candidate_type is not None:
        query = query.filter(Scan.candidate_type == candidate_type.value)

    scans = query.order_by(Scan.created_at.desc()).offset(offset).limit(limit).all()
    return [_to_scan_response(s) for s in scans]


@router.get("/{scan_id}", response_model=ScanResponse)
def get_scan(scan_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a specific scan record by ID.
    """
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan record with ID {scan_id} not found."
        )
    return _to_scan_response(scan)


@router.patch("/{scan_id}/status", response_model=ScanResponse)
def update_scan_status(
    scan_id: int,
    status_update: ScanStatusUpdate,
    db: Session = Depends(get_db)
):
    """
    Update triage status for a scan (completed, review_needed, false_positive, confirmed_threat).
    """
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan record with ID {scan_id} not found."
        )

    scan.status = status_update.status.value
    db.commit()
    db.refresh(scan)
    return _to_scan_response(scan)
