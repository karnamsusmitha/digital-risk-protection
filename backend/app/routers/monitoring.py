"""
Digital Risk Protection - Monitoring Router (Task 4)

Endpoints for:
1. Candidate asset collection (sample feeds or live external providers).
2. URL normalization, validation, and asset classification.
3. Sample candidate threat retrieval with explicit truth-in-labeling.
4. Monitoring provider diagnostic status.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Company
from app.schemas import (
    URLValidationRequest,
    URLValidationResponse,
    MonitoringCollectionRequest,
    MonitoringCollectionResponse,
    MonitoringStatusResponse,
    CollectedCandidateRecord,
)
from app.services.monitoring import (
    normalize_and_validate_url,
    generate_sample_candidates,
    collect_monitoring_candidates,
    DISCLAIMER_SAMPLE_DATA,
)

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Candidate Collection"])


@router.post(
    "/validate-url",
    response_model=URLValidationResponse,
    summary="Normalize and validate asset URL",
)
def validate_candidate_url(
    request: URLValidationRequest,
    db: Session = Depends(get_db),
):
    """
    Inspects, validates, and normalizes a candidate URL:
    - Strips marketing/tracking query parameters (utm_*, ref, fbclid).
    - Checks URL syntax and rejects invalid schemes.
    - Classifies asset type: 'domain', 'social_profile', or 'mobile_app'.
    - Identifies platform (Web, Twitter / X, Google Play, Apple App Store, etc.).
    - Compares candidate domain against registered official domains if company_id is provided.
    """
    official_domains = list(request.official_domains or [])
    if request.company_id:
        company = db.query(Company).filter(Company.id == request.company_id).first()
        if company and company.domain and company.domain not in official_domains:
            official_domains.append(company.domain)
        if company:
            assets = getattr(company, "protected_assets", []) or getattr(company, "assets", []) or []
            for asset in assets:
                atype = str(getattr(asset, "asset_type", "")).lower()
                val = getattr(asset, "value", None)
                if val and atype == "domain" and val not in official_domains:
                    official_domains.append(val)

    info = normalize_and_validate_url(request.url, official_domains=official_domains)

    reasons: List[str] = []
    if not info.is_valid:
        reasons.append(f"Validation Error: {info.validation_error}")
    else:
        reasons.append(f"URL normalized successfully. Classified as '{info.asset_type}' on platform '{info.platform}'.")
        if info.is_official_match:
            reasons.append(f"Official Match: Matches registered organization domain '{info.matched_official_domain}'.")
        else:
            reasons.append("External Candidate: Host does not match registered official organization domains.")

    return URLValidationResponse(
        url_info=info,
        is_valid=info.is_valid,
        asset_type=info.asset_type,
        platform=info.platform,
        is_official_match=info.is_official_match,
        matched_official_domain=info.matched_official_domain,
        reasons=reasons,
    )


@router.post(
    "/collect",
    response_model=MonitoringCollectionResponse,
    summary="Execute candidate asset collection",
)
def execute_monitoring_collection(
    request: MonitoringCollectionRequest,
    db: Session = Depends(get_db),
):
    """
    Executes monitoring and candidate asset collection:
    - Normalizes and checks any submitted URLs.
    - If use_live_providers is true, calls external provider with timeout/rate-limit safeguards.
    - If external provider is unavailable or not configured, safely returns labeled sample candidates.
    - Requirement 9 Guarantee: Never claims live monitoring is active when using sample data.
    - If persist_to_database is true, saves candidate assets into SQLite database.
    """
    if request.company_id:
        company = db.query(Company).filter(Company.id == request.company_id).first()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Company with ID {request.company_id} not found.",
            )

    return collect_monitoring_candidates(
        company_id=request.company_id,
        query_domain=request.query_domain,
        brand_name=request.brand_name,
        asset_types=request.asset_types,
        submitted_urls=request.submitted_urls,
        use_live_providers=request.use_live_providers,
        persist_to_database=request.persist_to_database,
        limit=request.limit,
        db=db,
    )


@router.get(
    "/sample-candidates",
    response_model=List[CollectedCandidateRecord],
    summary="Retrieve labeled sample candidate records",
)
def get_sample_candidates(
    brand_name: Optional[str] = Query("Acme Corp", description="Brand name for generated samples"),
    official_domain: Optional[str] = Query("acme.com", description="Official domain for comparison"),
    limit: int = Query(8, ge=1, le=50, description="Max candidate records to return"),
):
    """
    Returns realistic sample candidate records for testing, development, and offline demonstrations.
    Guaranteed: is_live_monitoring is False, monitoring_mode is 'simulated_sample'.
    """
    return generate_sample_candidates(
        brand_name=brand_name,
        official_domain=official_domain,
        limit=limit,
    )


@router.get(
    "/status",
    response_model=MonitoringStatusResponse,
    summary="Monitoring service diagnostic status",
)
def get_monitoring_status():
    """
    Returns operational diagnostics for monitoring adapters:
    - Provider configuration status
    - Configured timeout settings
    - Supported asset types and platforms
    """
    is_live_cfg = bool(settings.MONITORING_MODULE_URL)
    notice = (
        "Live external monitoring provider is configured."
        if is_live_cfg
        else "No external provider configured in MONITORING_MODULE_URL. Fallback sample data is active."
    )
    return MonitoringStatusResponse(
        service_status="operational",
        is_live_monitoring_configured=is_live_cfg,
        configured_provider_url=settings.MONITORING_MODULE_URL,
        request_timeout_seconds=settings.MODULE_REQUEST_TIMEOUT,
        notice=notice,
    )
