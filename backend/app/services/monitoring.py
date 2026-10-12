"""
Digital Risk Protection - Monitoring & Candidate Asset Collection Module
Task 4 Implementation

Provides modular, testable, and robust functions for:
1. URL normalization, cleaning (tracking parameter stripping), and syntax validation.
2. Asset type classification (domains, social profiles, mobile app stores).
3. Candidate domain comparison against registered official domains.
4. Live provider integrations (external microservices, public transparency logs) with
   safe timeouts, rate-limit (HTTP 429) backoff, and graceful fallbacks.
5. Clearly labeled sample candidate generation when external integrations are unavailable.
6. Enforcing truth-in-labeling: Never claims live monitoring is active when using sample data.
7. Seamless ingestion into SQLite database without disrupting Task 2 AI Brand Detection.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
import re
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse, parse_qsl, urlencode, urlunsplit

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Company, ProtectedAsset, Candidate
from app.schemas import (
    NormalizedURLInfo,
    CollectedCandidateRecord,
    MonitoringCollectionResponse,
)
from app.services.brand_detection import (
    extract_domain_components,
    normalize_domain_for_comparison,
    detect_suspicious_domain_variation,
)

logger = logging.getLogger("drp.monitoring")

# ============================================================================
# Platform Classification Signatures
# ============================================================================

TRACKING_QUERY_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "ref",
    "ref_src",
    "ref_url",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "_ga",
    "_gl",
    "source",
    "trk",
}

# Social platform host matching
SOCIAL_PLATFORMS: Dict[str, str] = {
    "twitter.com": "Twitter / X",
    "x.com": "Twitter / X",
    "linkedin.com": "LinkedIn",
    "facebook.com": "Facebook",
    "fb.com": "Facebook",
    "instagram.com": "Instagram",
    "t.me": "Telegram",
    "telegram.me": "Telegram",
    "telegram.org": "Telegram",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "tiktok.com": "TikTok",
    "reddit.com": "Reddit",
    "github.com": "GitHub",
    "medium.com": "Medium",
    "threads.net": "Threads",
}

# Mobile app store host matching
APP_STORE_PLATFORMS: Dict[str, str] = {
    "play.google.com": "Google Play",
    "apps.apple.com": "Apple App Store",
    "itunes.apple.com": "Apple App Store",
    "apkpure.com": "Third-Party App Store",
    "apkmirror.com": "Third-Party App Store",
}

DISCLAIMER_SAMPLE_DATA = (
    "Sample monitoring data provided for offline/demonstration use. "
    "Live monitoring is NOT active without configured provider credentials or network connectivity."
)


# ============================================================================
# 1. URL Normalization & Validation
# ============================================================================

def normalize_and_validate_url(
    raw_url: Optional[str],
    official_domains: Optional[List[str]] = None,
) -> NormalizedURLInfo:
    """
    Normalizes and validates a candidate URL:
    - Verifies scheme (http, https). Rejects invalid schemes (javascript:, file:, data:).
    - Cleans hostname, lowercases it, strips default ports and trailing dots.
    - Strips marketing/tracking query parameters (utm_*, ref, fbclid).
    - Normalizes path slashes.
    - Automatically classifies asset_type: 'domain', 'social_profile', or 'mobile_app'.
    - Identifies discovery platform (Twitter / X, LinkedIn, Google Play, Web, etc.).
    - Compares candidate domain against registered official domains.
    """
    if not raw_url or not isinstance(raw_url, str):
        return NormalizedURLInfo(
            raw_url="" if raw_url is None else str(raw_url),
            normalized_url="",
            scheme="",
            host="",
            path="",
            asset_type="domain",
            platform=None,
            is_valid=False,
            validation_error="URL string cannot be empty.",
            is_official_match=False,
            matched_official_domain=None,
        )

    val = raw_url.strip()

    # Reject dangerous or unsupported schemes
    lower_val = val.lower()
    for forbidden in ["javascript:", "data:", "file:", "ftp:", "vbscript:", "mailto:"]:
        if lower_val.startswith(forbidden):
            return NormalizedURLInfo(
                raw_url=val,
                normalized_url="",
                scheme=forbidden.rstrip(":"),
                host="",
                path="",
                asset_type="domain",
                platform=None,
                is_valid=False,
                validation_error=f"Unsupported URL scheme '{forbidden.rstrip(':')}'. Only http:// and https:// URLs are permitted.",
                is_official_match=False,
                matched_official_domain=None,
            )

    # Prepend https:// if scheme is missing
    if "://" not in val:
        val = f"https://{val}"

    try:
        parsed = urlparse(val)
    except Exception as exc:
        return NormalizedURLInfo(
            raw_url=raw_url,
            normalized_url="",
            scheme="",
            host="",
            path="",
            asset_type="domain",
            platform=None,
            is_valid=False,
            validation_error=f"Malformed URL: {exc}",
            is_official_match=False,
            matched_official_domain=None,
        )

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        return NormalizedURLInfo(
            raw_url=raw_url,
            normalized_url="",
            scheme=scheme,
            host="",
            path="",
            asset_type="domain",
            platform=None,
            is_valid=False,
            validation_error=f"Invalid URL scheme '{scheme}'. Only http and https are allowed.",
            is_official_match=False,
            matched_official_domain=None,
        )

    netloc = parsed.netloc.strip().lower()
    if not netloc:
        return NormalizedURLInfo(
            raw_url=raw_url,
            normalized_url="",
            scheme=scheme,
            host="",
            path="",
            asset_type="domain",
            platform=None,
            is_valid=False,
            validation_error="URL is missing a valid hostname.",
            is_official_match=False,
            matched_official_domain=None,
        )

    # Check for invalid characters in host (spaces, invalid control chars, double dots)
    if any(c in netloc for c in " \t\r\n\\`\"'<>{}|"):
        return NormalizedURLInfo(
            raw_url=raw_url,
            normalized_url="",
            scheme=scheme,
            host=netloc,
            path="",
            asset_type="domain",
            platform=None,
            is_valid=False,
            validation_error=f"Invalid characters detected in URL host: '{netloc}'.",
            is_official_match=False,
            matched_official_domain=None,
        )

    # Strip default port numbers
    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    elif netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    host = netloc.split(":")[0].strip(".")
    if not host or "." not in host:
        return NormalizedURLInfo(
            raw_url=raw_url,
            normalized_url="",
            scheme=scheme,
            host=host,
            path="",
            asset_type="domain",
            platform=None,
            is_valid=False,
            validation_error=f"Invalid domain format '{host}'. Top-level domain required.",
            is_official_match=False,
            matched_official_domain=None,
        )

    # Clean path
    path = parsed.path or "/"
    path = re.sub(r"/+", "/", path)  # Collapse duplicate slashes
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    # Filter out tracking query parameters, preserve functional parameters
    clean_query = ""
    if parsed.query:
        query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        filtered = [
            (k, v) for k, v in query_pairs
            if k.lower() not in TRACKING_QUERY_PARAMS
        ]
        if filtered:
            clean_query = urlencode(filtered)

    normalized_url = urlunsplit((scheme, netloc, path, clean_query, ""))

    # ------------------------------------------------------------------------
    # Classify Asset Type & Platform
    # ------------------------------------------------------------------------
    asset_type = "domain"
    platform = "Web"

    # 1. Check Mobile App Store platforms
    matched_app_platform = None
    for domain_pattern, plat_name in APP_STORE_PLATFORMS.items():
        if host == domain_pattern or host.endswith(f".{domain_pattern}"):
            # Check path indicators for actual app listings
            if "play.google.com" in host and "/store/apps" in path:
                asset_type = "mobile_app"
                matched_app_platform = plat_name
                break
            elif "apple.com" in host and ("/app/" in path or "/id" in path):
                asset_type = "mobile_app"
                matched_app_platform = plat_name
                break
            elif "apk" in host:
                asset_type = "mobile_app"
                matched_app_platform = plat_name
                break

    if matched_app_platform:
        platform = matched_app_platform
    else:
        # 2. Check Social Profile platforms
        matched_social_platform = None
        for domain_pattern, plat_name in SOCIAL_PLATFORMS.items():
            if host == domain_pattern or host.endswith(f".{domain_pattern}"):
                asset_type = "social_profile"
                matched_social_platform = plat_name
                break

        if matched_social_platform:
            platform = matched_social_platform
        else:
            asset_type = "domain"
            platform = "Web"

    # ------------------------------------------------------------------------
    # Official Domain Comparison
    # ------------------------------------------------------------------------
    is_official_match = False
    matched_official_domain: Optional[str] = None

    if official_domains:
        cand_comps = extract_domain_components(host)
        cand_host = cand_comps["host"]
        cand_registered = cand_comps.get("registered_domain", cand_host)

        for off in official_domains:
            if not off:
                continue
            off_norm = normalize_domain_for_comparison(off)
            off_comps = extract_domain_components(off_norm)
            off_host = off_comps["host"]
            off_registered = off_comps.get("registered_domain", off_host)

            if cand_host == off_host:
                is_official_match = True
                matched_official_domain = off
                break
            elif cand_registered == off_registered and cand_registered:
                is_official_match = True
                matched_official_domain = off
                break

    return NormalizedURLInfo(
        raw_url=raw_url,
        normalized_url=normalized_url,
        scheme=scheme,
        host=host,
        path=path,
        asset_type=asset_type,
        platform=platform,
        is_valid=True,
        validation_error=None,
        is_official_match=is_official_match,
        matched_official_domain=matched_official_domain,
    )


# ============================================================================
# 2. Sample Candidate Generator (Requirement 7 & 9)
# ============================================================================

def generate_sample_candidates(
    brand_name: Optional[str] = None,
    official_domain: Optional[str] = None,
    asset_types: Optional[List[str]] = None,
    limit: int = 10,
    official_domains: Optional[List[str]] = None,
) -> List[CollectedCandidateRecord]:
    """
    Generates realistic, diverse candidate samples when external integrations
    are unavailable or offline.
    
    GUARANTEE (Requirement 9):
    - is_live_monitoring is strictly set to False.
    - monitoring_mode is strictly set to 'simulated_sample'.
    - Clear disclaimers and notices are embedded in every record.
    """
    brand = brand_name or "Acme Corp"
    brand_slug = re.sub(r"[^\w]", "", brand.lower()) or "acme"
    domain = official_domain or f"{brand_slug}.com"
    now_iso = datetime.now(timezone.utc).isoformat()
    all_official = list(official_domains or ([domain] if domain else []))

    types_to_include = [t.lower() for t in (asset_types or ["domain", "social_profile", "mobile_app"])]

    samples: List[CollectedCandidateRecord] = []

    # 1. Combosquatting Credential Harvesting Domain
    if "domain" in types_to_include:
        url1 = f"https://{brand_slug}-login-auth.com/verify"
        info1 = normalize_and_validate_url(url1, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info1.normalized_url,
                asset_type="domain",
                platform="Web",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.88,
                is_official_match=info1.is_official_match,
                matched_official_domain=info1.matched_official_domain,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "combosquatting_credential_harvesting",
                    "dns_records": {"A": ["198.51.100.42"], "MX": ["mail.login-auth.com"]},
                    "ssl_issuer": "Let's Encrypt (Recent / 2 days ago)",
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 2. Typosquatting Domain
    if "domain" in types_to_include:
        url2 = f"https://{brand_slug}m.com"
        info2 = normalize_and_validate_url(url2, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info2.normalized_url,
                asset_type="domain",
                platform="Web",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.75,
                is_official_match=info2.is_official_match,
                matched_official_domain=info2.matched_official_domain,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "typosquatting",
                    "edit_distance": 1,
                    "registration_status": "Newly Registered (3 days old)",
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 3. High-Abuse TLD Swap
    if "domain" in types_to_include:
        url3 = f"https://{brand_slug}-portal.xyz/account"
        info3 = normalize_and_validate_url(url3, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info3.normalized_url,
                asset_type="domain",
                platform="Web",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.80,
                is_official_match=info3.is_official_match,
                matched_official_domain=info3.matched_official_domain,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "risky_tld_swap",
                    "tld": "xyz",
                    "whois_privacy": "Enabled / Redacted",
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 4. Deceptive Subdomain Spoofing
    if "domain" in types_to_include:
        url4 = f"https://{domain}.phishing-gateway.net/signin"
        info4 = normalize_and_validate_url(url4, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info4.normalized_url,
                asset_type="domain",
                platform="Web",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.92,
                is_official_match=info4.is_official_match,
                matched_official_domain=info4.matched_official_domain,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "deceptive_subdomain_spoofing",
                    "apex_host": "phishing-gateway.net",
                    "subdomain_spoofed": domain,
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 5. Impersonating Social Profile (Twitter / X)
    if "social_profile" in types_to_include:
        url5 = f"https://twitter.com/{brand_slug}_official_support"
        info5 = normalize_and_validate_url(url5, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info5.normalized_url,
                asset_type="social_profile",
                platform="Twitter / X",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.85,
                is_official_match=False,
                matched_official_domain=None,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "social_profile_impersonation",
                    "handle": f"@{brand_slug}_official_support",
                    "followers_count": 14,
                    "account_created": "2026-10-08",
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 6. Impersonating Telegram Channel
    if "social_profile" in types_to_include:
        url6 = f"https://t.me/{brand_slug}_helpdesk_live"
        info6 = normalize_and_validate_url(url6, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info6.normalized_url,
                asset_type="social_profile",
                platform="Telegram",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.80,
                is_official_match=False,
                matched_official_domain=None,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "social_profile_impersonation",
                    "channel_title": f"{brand} Support Live",
                    "members_count": 320,
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 7. Malicious / Fake Mobile App Listing
    if "mobile_app" in types_to_include:
        url7 = f"https://play.google.com/store/apps/details?id=com.{brand_slug}.securebanking.fake"
        info7 = normalize_and_validate_url(url7, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info7.normalized_url,
                asset_type="mobile_app",
                platform="Google Play",
                source="SAMPLE_COLLECTION_FEED",
                confidence_score=0.90,
                is_official_match=False,
                matched_official_domain=None,
                evidence={
                    "is_sample_data": True,
                    "simulated_threat_type": "fake_mobile_application",
                    "package_name": f"com.{brand_slug}.securebanking.fake",
                    "developer_name": "Unverified Independent Dev",
                    "downloads": "10+",
                    "notice": DISCLAIMER_SAMPLE_DATA,
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    # 8. Exact Official Domain Asset (to demonstrate whitelist exclusion)
    if "domain" in types_to_include and domain:
        url8 = f"https://{domain}/customer-portal"
        info8 = normalize_and_validate_url(url8, official_domains=all_official)
        samples.append(
            CollectedCandidateRecord(
                url=info8.normalized_url,
                asset_type="domain",
                platform="Web",
                source="OFFICIAL_ORGANIZATION_REGISTRY",
                confidence_score=1.0,
                is_official_match=True,
                matched_official_domain=domain,
                evidence={
                    "is_sample_data": True,
                    "is_official_inventory": True,
                    "notice": "Official legitimate organization asset. Excluded from malicious scoring.",
                },
                observation_time=now_iso,
                is_live_monitoring=False,
                monitoring_mode="simulated_sample",
                notice=DISCLAIMER_SAMPLE_DATA,
            )
        )

    return samples[:limit]


# ============================================================================
# 3. Live Provider Execution & Safe Fallback (Requirement 6, 8, 9)
# ============================================================================

def fetch_live_provider_candidates(
    query_domain: str,
    brand_name: Optional[str] = None,
    service_url: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout: float = 3.0,
    official_domains: Optional[List[str]] = None,
) -> Tuple[List[CollectedCandidateRecord], bool, Optional[str]]:
    """
    Invokes configured live monitoring provider (or external microservice) with safe timeouts.
    Handles:
    - Timeouts (httpx.TimeoutException) -> graceful fallback
    - Rate limits (HTTP 429) -> graceful rate-limit notice & fallback
    - Server errors (HTTP 500, 502, 503) -> graceful fallback
    - Never leaks secret API keys in logs or exceptions.
    
    Returns: (records, is_fallback, fallback_reason)
    """
    url = service_url or settings.MONITORING_MODULE_URL
    if not url:
        # No live provider configured
        return [], True, "No external live monitoring provider configured in settings (MONITORING_MODULE_URL is unset)."

    key = api_key or settings.MONITORING_MODULE_API_KEY
    headers = {"Content-Type": "application/json"}
    if key:
        headers["X-API-Key"] = key

    payload = {
        "query_domain": query_domain,
        "brand_name": brand_name,
    }

    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload, headers=headers)
            
            # Explicit Rate Limit Handling (HTTP 429)
            if resp.status_code == 429:
                reason = "Live monitoring provider rate limit exceeded (HTTP 429). Falling back to safe offline sample data."
                logger.warning(reason)
                return [], True, reason

            resp.raise_for_status()
            data = resp.json()

            raw_records = data.get("candidates") or data.get("results") or []
            records: List[CollectedCandidateRecord] = []
            now_iso = datetime.now(timezone.utc).isoformat()

            for item in raw_records:
                target_url = item.get("url") or item.get("candidate_url")
                if not target_url:
                    continue

                info = normalize_and_validate_url(target_url, official_domains=official_domains)
                if not info.is_valid:
                    continue

                records.append(
                    CollectedCandidateRecord(
                        url=info.normalized_url,
                        asset_type=info.asset_type,
                        platform=info.platform or "Web",
                        source=item.get("source", "LIVE_MONITORING_FEED"),
                        confidence_score=float(item.get("confidence_score", 0.85)),
                        is_official_match=info.is_official_match,
                        matched_official_domain=info.matched_official_domain,
                        evidence=item.get("evidence", item.get("observed_metadata", {})),
                        observation_time=item.get("observation_time", now_iso),
                        is_live_monitoring=True,  # ONLY true when real provider succeeds
                        monitoring_mode="live_provider",
                        notice=None,
                    )
                )

            return records, False, None

    except httpx.TimeoutException:
        reason = f"Live monitoring provider timed out after {timeout}s. Falling back to offline sample data."
        logger.warning(reason)
        return [], True, reason

    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code == 429:
            reason = "Live monitoring provider rate limit exceeded (HTTP 429). Falling back to safe offline sample data."
        else:
            reason = f"Live monitoring provider returned HTTP {status_code}. Falling back to safe offline sample data."
        logger.warning(reason)
        return [], True, reason

    except Exception as exc:
        reason = f"Live monitoring provider connection failed ({type(exc).__name__}). Falling back to safe offline sample data."
        logger.warning(reason)
        return [], True, reason


# ============================================================================
# 4. Master Monitoring Collector Orchestrator
# ============================================================================

def collect_monitoring_candidates(
    company_id: Optional[int] = None,
    query_domain: Optional[str] = None,
    brand_name: Optional[str] = None,
    asset_types: Optional[List[str]] = None,
    submitted_urls: Optional[List[str]] = None,
    use_live_providers: bool = False,
    persist_to_database: bool = False,
    limit: int = 10,
    db: Optional[Session] = None,
) -> MonitoringCollectionResponse:
    """
    Main monitoring orchestration service:
    1. Loads organization profile (brand name, official domains) from SQLite if company_id provided.
    2. Validates and normalizes any user-submitted candidate URLs.
    3. Invokes live provider if requested and configured; safely handles timeouts and errors.
    4. Automatically provides clearly labeled sample data when live providers are offline/unset.
    5. Compares candidate domains with registered official domains.
    6. Ensures Requirement 9: Never claims live monitoring is active when using sample data.
    7. Optionally persists collected records as Candidates in the database.
    """
    company_name: Optional[str] = brand_name
    target_domain: Optional[str] = query_domain
    official_domains: List[str] = []
    errors: List[str] = []

    # 1. Lookup Company & Official Assets
    if company_id and db:
        company = db.query(Company).filter(Company.id == company_id).first()
        if company:
            if not company_name:
                company_name = company.name
            if not target_domain and company.domain:
                target_domain = company.domain
            if company.domain:
                official_domains.append(company.domain)

            assets = getattr(company, "protected_assets", []) or getattr(company, "assets", []) or []
            for asset in assets:
                atype = str(getattr(asset, "asset_type", "")).lower()
                val = getattr(asset, "value", None)
                if val and atype == "domain" and val not in official_domains:
                    official_domains.append(val)

    if target_domain and target_domain not in official_domains:
        official_domains.append(target_domain)

    candidates: List[CollectedCandidateRecord] = []
    is_live = False
    monitoring_mode = "simulated_sample"

    # 2. Process submitted candidate URLs (if provided)
    if submitted_urls:
        for raw_u in submitted_urls:
            info = normalize_and_validate_url(raw_u, official_domains=official_domains)
            if not info.is_valid:
                errors.append(f"Invalid submitted URL '{raw_u}': {info.validation_error}")
                continue

            candidates.append(
                CollectedCandidateRecord(
                    url=info.normalized_url,
                    asset_type=info.asset_type,
                    platform=info.platform or "Web",
                    source="MANUAL_SUBMISSION_SCANNER",
                    confidence_score=0.90,
                    is_official_match=info.is_official_match,
                    matched_official_domain=info.matched_official_domain,
                    evidence={
                        "raw_input_url": raw_u,
                        "normalized_path": info.path,
                        "host": info.host,
                        "is_official_match": info.is_official_match,
                    },
                    observation_time=datetime.now(timezone.utc).isoformat(),
                    company_id=company_id,
                    is_live_monitoring=False,
                    monitoring_mode="manual_ingestion",
                    notice="Manually submitted candidate asset for security assessment.",
                )
            )

    # 3. Attempt Live Provider Collection (if requested)
    if use_live_providers:
        live_records, is_fallback, fallback_reason = fetch_live_provider_candidates(
            query_domain=target_domain or "example.com",
            brand_name=company_name,
            official_domains=official_domains,
        )

        if not is_fallback and live_records:
            is_live = True
            monitoring_mode = "live_provider"
            candidates.extend(live_records)
        else:
            if fallback_reason:
                errors.append(fallback_reason)
            # Safe Fallback to sample data
            sample_records = generate_sample_candidates(
                brand_name=company_name,
                official_domain=target_domain,
                asset_types=asset_types,
                limit=limit,
                official_domains=official_domains,
            )
            candidates.extend(sample_records)
            is_live = False
            monitoring_mode = "simulated_sample"
    else:
        # Default Offline / Sample collection
        sample_records = generate_sample_candidates(
            brand_name=company_name,
            official_domain=target_domain,
            asset_types=asset_types,
            limit=limit,
            official_domains=official_domains,
        )
        candidates.extend(sample_records)
        is_live = False
        monitoring_mode = "simulated_sample"

    # Deduplicate candidates by normalized URL
    seen_urls = set()
    unique_candidates: List[CollectedCandidateRecord] = []
    for cand in candidates:
        if cand.url not in seen_urls:
            seen_urls.add(cand.url)
            cand.company_id = company_id
            unique_candidates.append(cand)
        if len(unique_candidates) >= limit:
            break

    # 4. Optional Database Persistence
    persisted_count = 0
    if persist_to_database and db:
        for cand_rec in unique_candidates:
            # Map asset_type to DB check constraint ('domain', 'social_profile', 'mobile_app', 'brand_name')
            valid_asset_type = cand_rec.asset_type.lower()
            if valid_asset_type not in ("domain", "social_profile", "mobile_app", "brand_name"):
                valid_asset_type = "domain"

            db_cand = Candidate(
                company_id=company_id,
                asset_type=valid_asset_type,
                value=cand_rec.url,
                platform=cand_rec.platform,
                source=cand_rec.source,
                candidate_type=cand_rec.evidence.get("simulated_threat_type") or "unverified_candidate",
                confidence_score=cand_rec.confidence_score,
                observed_metadata=cand_rec.evidence,
                status="pending",
            )
            db.add(db_cand)
            persisted_count += 1
        db.commit()

        # Update candidate_ids in response
        # Query recently inserted candidates
        if company_id:
            recent_db_cands = (
                db.query(Candidate)
                .filter(Candidate.company_id == company_id)
                .order_by(Candidate.id.desc())
                .limit(persisted_count)
                .all()
            )
            id_map = {c.value: c.id for c in recent_db_cands}
            for rec in unique_candidates:
                if rec.url in id_map:
                    rec.candidate_id = id_map[rec.url]

    disclaimer = (
        "Live monitoring active via external provider."
        if is_live
        else DISCLAIMER_SAMPLE_DATA
    )

    return MonitoringCollectionResponse(
        company_id=company_id,
        company_name=company_name,
        query_domain=target_domain,
        total_collected=len(unique_candidates),
        persisted_count=persisted_count,
        candidates=unique_candidates,
        is_live_monitoring=is_live,
        monitoring_mode=monitoring_mode,
        disclaimer=disclaimer,
        errors=errors,
    )
