from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company, Asset, Candidate, Finding
from app.schemas import (
    CompanyRiskPosture,
    SeverityBreakdown,
    CandidateEvaluationRequest,
    CandidateEvaluationResponse,
    AnalyzeRequest,
    AnalyzeResponse,
    FindingResponse,
    BrandImpersonationDetectRequest,
    BrandImpersonationDetectResponse,
)
from typing import List
from app.services.risk_scoring import (
    recalculate_company_risk,
    evaluate_candidate_signal,
    score_and_persist_threat,
    get_risk_level_label,
)

router = APIRouter(tags=["Analysis & Risk Scoring"])


@router.get("/analysis/company/{company_id}/summary", response_model=CompanyRiskPosture)
def get_company_risk_summary(
    company_id: int,
    db: Session = Depends(get_db),
):
    """
    Get comprehensive Digital Risk Protection posture for a company,
    including overall score, risk tier, asset counts, and active severity breakdown.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found.",
        )

    # Assets
    total_assets = db.query(Asset).filter(Asset.company_id == company_id).count()

    # Candidates
    total_candidates = db.query(Candidate).filter(Candidate.company_id == company_id).count()
    pending_candidates = (
        db.query(Candidate)
        .filter(Candidate.company_id == company_id, func.lower(Candidate.status) == "pending")
        .count()
    )

    # Findings
    all_findings = db.query(Finding).filter(Finding.company_id == company_id).all()
    open_findings = [f for f in all_findings if (f.status or "").lower() in ("open", "in_review", "pending")]

    breakdown = SeverityBreakdown(
        CRITICAL=sum(1 for f in open_findings if (f.severity or "").lower() == "critical"),
        HIGH=sum(1 for f in open_findings if (f.severity or "").lower() == "high"),
        MEDIUM=sum(1 for f in open_findings if (f.severity or "").lower() == "medium"),
        LOW=sum(1 for f in open_findings if (f.severity or "").lower() == "low"),
    )

    # Recent findings sorted by creation
    recent_findings = (
        db.query(Finding)
        .filter(Finding.company_id == company_id)
        .order_by(Finding.created_at.desc())
        .limit(5)
        .all()
    )

    return CompanyRiskPosture(
        company_id=company.id,
        company_name=company.name,
        overall_risk_score=company.overall_risk_score,
        risk_level=get_risk_level_label(company.overall_risk_score),
        total_assets=total_assets,
        total_candidates=total_candidates,
        pending_candidates=pending_candidates,
        total_findings=len(all_findings),
        open_findings=len(open_findings),
        severity_breakdown=breakdown,
        recent_findings=[FindingResponse.model_validate(f) for f in recent_findings],
    )


@router.post("/analysis/company/{company_id}/recalculate", response_model=Dict[str, Any])
def trigger_company_risk_recalculation(
    company_id: int,
    db: Session = Depends(get_db),
):
    """
    Force a re-evaluation and recalculation of a company's overall risk score.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found.",
        )
    new_score = recalculate_company_risk(company_id, db)
    return {
        "company_id": company_id,
        "company_name": company.name,
        "overall_risk_score": new_score,
        "risk_level": get_risk_level_label(new_score),
        "message": "Risk score recalculated successfully.",
    }


@router.post("/analysis/evaluate-candidate", response_model=CandidateEvaluationResponse)
@router.post("/evaluate-candidate", response_model=CandidateEvaluationResponse, include_in_schema=False)
def evaluate_candidate(
    request: CandidateEvaluationRequest,
):
    """
    Stateless risk assessment endpoint designed for teammate AI & monitoring modules.
    Evaluates raw threat indicators, suggests risk severity, score, and remediation.
    """
    return evaluate_candidate_signal(
        candidate_type=request.candidate_type,
        source=request.source,
        raw_data=request.raw_data,
        threat_indicators=request.threat_indicators,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
@router.post("/analyze/", response_model=AnalyzeResponse, include_in_schema=False)
@router.post("/analysis/analyze", response_model=AnalyzeResponse, include_in_schema=False)
def analyze_threat(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    """
    Perform explainable security analysis on threat indicators for a company asset,
    calculating risk score, severity, remediation, and persisting finding in SQLite database.
    """
    company = db.query(Company).filter(Company.id == request.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {request.company_id} not found.",
        )

    if request.asset_id:
        asset = db.query(Asset).filter(Asset.id == request.asset_id).first()
        if not asset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset with ID {request.asset_id} not found.",
            )

    return score_and_persist_threat(
        company=company,
        request=request,
        db=db,
    )


@router.post("/analysis/detect-brand-impersonation", response_model=BrandImpersonationDetectResponse)
@router.post("/analysis/impersonation", response_model=BrandImpersonationDetectResponse, include_in_schema=False)
@router.post("/detect-impersonation", response_model=BrandImpersonationDetectResponse, include_in_schema=False)
def detect_brand_impersonation_endpoint(
    request: BrandImpersonationDetectRequest,
    db: Session = Depends(get_db),
):
    """
    Dedicated AI-based & deterministic brand impersonation detector:
    - Compares candidate brand names against registered official brands.
    - Detects look-alike names using text normalization, edit distance, and homoglyphs.
    - Identifies suspicious domain variations: typosquatting, combosquatting, deceptive subdomains, TLD swaps.
    - Returns explainable risk score (0 to 100) with detailed reasons.
    - Guaranteed: Does not classify an asset as malicious based only on name similarity.
    """
    official_brands: List[str] = list(request.official_brand_names or [])
    official_domains: List[str] = list(request.official_domains or [])

    if request.company_id:
        company = db.query(Company).filter(Company.id == request.company_id).first()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company with ID {request.company_id} not found.",
            )
        if company.name and company.name not in official_brands:
            official_brands.append(company.name)
        if company.domain and company.domain not in official_domains:
            official_domains.append(company.domain)

        official_assets = getattr(company, "protected_assets", []) or getattr(company, "assets", []) or []
        for asset in official_assets:
            atype = str(getattr(asset, "asset_type", "")).lower()
            val = getattr(asset, "value", None)
            if val:
                if atype == "brand_name" and val not in official_brands:
                    official_brands.append(val)
                elif atype == "domain" and val not in official_domains:
                    official_domains.append(val)

    from app.services.brand_detection import evaluate_brand_impersonation

    result = evaluate_brand_impersonation(
        candidate_name=request.candidate_name,
        candidate_domain=request.candidate_domain,
        official_brand_names=official_brands,
        official_domains=official_domains,
        context_indicators=request.context_indicators,
    )

    return BrandImpersonationDetectResponse(
        candidate_name=result.candidate_name,
        candidate_domain=result.candidate_domain,
        matched_brand=result.matched_brand,
        matched_official_domain=result.matched_official_domain,
        name_similarity=result.name_similarity,
        is_name_lookalike=result.is_name_lookalike,
        is_domain_variation=result.is_domain_variation,
        variation_types=result.variation_types,
        homoglyphs_detected=result.homoglyphs_detected,
        is_official_match=result.is_official_match,
        risk_score=result.risk_score,
        severity=result.severity,
        reasons=result.reasons,
        evidence=result.evidence,
        remediation_guidance=result.remediation_guidance,
    )


