from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company, ProtectedAsset, Candidate, RiskFinding
from app.schemas import (
    DashboardSummaryResponse,
    RiskFindingResponse,
    SeverityBreakdown,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
@router.get("/summary/", response_model=DashboardSummaryResponse, include_in_schema=False)
def get_dashboard_summary(
    company_id: Optional[int] = Query(None, description="Filter metrics for a specific company ID"),
    limit_recent: int = Query(5, ge=1, le=50, description="Maximum number of recent findings to return"),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    """
    Retrieve executive dashboard metrics for Digital Risk Protection.
    Returns:
    - total_protected_assets: count of defended brand, domain, profile, and app assets
    - total_candidates_analyzed: count of evaluated threat candidate signals
    - findings_by_severity: breakdown across critical, high, medium, and low tiers
    - recent_findings: latest security findings
    Returns clean 200 OK with zeroed counts on an empty database.
    """
    # 1. Protected Assets Count
    asset_query = db.query(ProtectedAsset)
    if company_id is not None:
        asset_query = asset_query.filter(ProtectedAsset.company_id == company_id)
    total_protected_assets = asset_query.count()

    # 2. Candidates Analyzed Count
    cand_query = db.query(Candidate)
    if company_id is not None:
        cand_query = cand_query.filter(Candidate.company_id == company_id)
    total_candidates = cand_query.count()

    finding_query = db.query(RiskFinding)
    if company_id is not None:
        finding_query = finding_query.filter(RiskFinding.company_id == company_id)
    all_findings = finding_query.all()
    total_findings = len(all_findings)

    # In DRP, candidates analyzed reflects all candidate signals or findings evaluated
    total_candidates_analyzed = max(total_candidates, total_findings)

    # 3. Findings By Severity
    crit_count = sum(1 for f in all_findings if (f.severity or "").lower() == "critical")
    high_count = sum(1 for f in all_findings if (f.severity or "").lower() == "high")
    med_count = sum(1 for f in all_findings if (f.severity or "").lower() == "medium")
    low_count = sum(1 for f in all_findings if (f.severity or "").lower() == "low")

    findings_by_severity = {
        "critical": crit_count,
        "high": high_count,
        "medium": med_count,
        "low": low_count,
        "CRITICAL": crit_count,
        "HIGH": high_count,
        "MEDIUM": med_count,
        "LOW": low_count,
    }

    # 4. Recent Findings
    recent_findings_db = (
        finding_query.order_by(RiskFinding.created_at.desc())
        .limit(limit_recent)
        .all()
    )
    recent_findings = [RiskFindingResponse.model_validate(f) for f in recent_findings_db]

    # 5. Supplementary Posture Counts
    open_findings = sum(
        1 for f in all_findings if (f.status or "").lower() in ("open", "pending", "in_review")
    )

    if company_id is not None:
        company_exists = db.query(Company).filter(Company.id == company_id).first() is not None
        total_companies = 1 if company_exists else 0
    else:
        total_companies = db.query(Company).count()

    severity_breakdown = SeverityBreakdown(
        CRITICAL=crit_count,
        HIGH=high_count,
        MEDIUM=med_count,
        LOW=low_count,
    )

    return DashboardSummaryResponse(
        total_protected_assets=total_protected_assets,
        total_candidates_analyzed=total_candidates_analyzed,
        findings_by_severity=findings_by_severity,
        recent_findings=recent_findings,
        total_findings=total_findings,
        open_findings=open_findings,
        total_companies=total_companies,
        total_assets=total_protected_assets,
        total_candidates=total_candidates_analyzed,
        severity_breakdown=severity_breakdown,
    )
