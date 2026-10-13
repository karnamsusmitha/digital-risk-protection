from typing import Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Brand, Scan
from app.schemas import DashboardSummary
from app.api.scans import _to_scan_response

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Retrieve comprehensive aggregate metrics, risk distributions, recent scans,
    and priority findings requiring analyst review.
    """
    total_brands = db.query(func.count(Brand.id)).scalar() or 0
    total_scans = db.query(func.count(Scan.id)).scalar() or 0

    # Risk category distribution
    risk_counts = (
        db.query(Scan.risk_category, func.count(Scan.id))
        .group_by(Scan.risk_category)
        .all()
    )
    risk_distribution: Dict[str, int] = {
        "Low": 0,
        "Medium": 0,
        "High": 0,
        "Critical": 0
    }
    for cat, count in risk_counts:
        if cat in risk_distribution:
            risk_distribution[cat] = count
        else:
            risk_distribution[cat] = count

    # Status distribution
    status_counts = (
        db.query(Scan.status, func.count(Scan.id))
        .group_by(Scan.status)
        .all()
    )
    status_distribution: Dict[str, int] = {
        "completed": 0,
        "review_needed": 0,
        "false_positive": 0,
        "confirmed_threat": 0
    }
    for st, count in status_counts:
        status_distribution[st] = count

    # Candidate type distribution
    type_counts = (
        db.query(Scan.candidate_type, func.count(Scan.id))
        .group_by(Scan.candidate_type)
        .all()
    )
    type_distribution: Dict[str, int] = {
        "domain": 0,
        "url": 0,
        "social_media_profile": 0,
        "mobile_app": 0
    }
    for t, count in type_counts:
        type_distribution[t] = count

    # Recent scans (latest 5)
    recent = (
        db.query(Scan)
        .order_by(Scan.created_at.desc())
        .limit(5)
        .all()
    )

    # Findings needing review (High/Critical or status == review_needed, limit 10)
    needing_review = (
        db.query(Scan)
        .filter(
            (Scan.status == "review_needed") |
            (Scan.risk_category.in_(["High", "Critical"]))
        )
        .order_by(Scan.risk_score.desc(), Scan.created_at.desc())
        .limit(10)
        .all()
    )

    return DashboardSummary(
        total_brands=total_brands,
        total_scans=total_scans,
        risk_distribution=risk_distribution,
        status_distribution=status_distribution,
        type_distribution=type_distribution,
        recent_scans=[_to_scan_response(s) for s in recent],
        findings_needing_review=[_to_scan_response(s) for s in needing_review]
    )
