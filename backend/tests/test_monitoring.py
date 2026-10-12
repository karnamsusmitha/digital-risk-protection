import pytest
from unittest.mock import patch, MagicMock
import httpx

from app.models import Company, ProtectedAsset, Candidate
from app.services.monitoring import (
    normalize_and_validate_url,
    generate_sample_candidates,
    fetch_live_provider_candidates,
    collect_monitoring_candidates,
    DISCLAIMER_SAMPLE_DATA,
)
from app.services.brand_detection import evaluate_brand_impersonation


# ============================================================================
# 1. URL Normalization Tests
# ============================================================================

def test_url_normalization_strips_tracking_params_and_normalizes_host():
    raw = "https://Acme-Corp.Com:443/login/auth/?utm_source=twitter&utm_medium=social&ref=feed_news#section1"
    info = normalize_and_validate_url(raw)

    assert info.is_valid is True
    assert info.host == "acme-corp.com"
    assert info.scheme == "https"
    assert info.path == "/login/auth"
    # Tracking parameters stripped
    assert "utm_source" not in info.normalized_url
    assert "utm_medium" not in info.normalized_url
    assert "ref=" not in info.normalized_url
    assert info.normalized_url == "https://acme-corp.com/login/auth"


def test_url_normalization_prepends_https_when_missing():
    raw = "portal.acme-security.com/dashboard"
    info = normalize_and_validate_url(raw)

    assert info.is_valid is True
    assert info.scheme == "https"
    assert info.host == "portal.acme-security.com"
    assert info.normalized_url == "https://portal.acme-security.com/dashboard"


# ============================================================================
# 2. URL Validation Tests (Invalid Schemes & Hosts)
# ============================================================================

def test_url_validation_rejects_unsupported_schemes():
    js_url = "javascript:alert('xss')"
    info = normalize_and_validate_url(js_url)
    assert info.is_valid is False
    assert info.validation_error is not None
    assert "Unsupported URL scheme" in info.validation_error

    file_url = "file:///etc/passwd"
    info_file = normalize_and_validate_url(file_url)
    assert info_file.is_valid is False
    assert info_file.validation_error is not None
    assert "Unsupported URL scheme" in info_file.validation_error


def test_url_validation_rejects_malformed_hosts():
    # Host containing spaces
    info_space = normalize_and_validate_url("https://bad host.com/path")
    assert info_space.is_valid is False
    assert info_space.validation_error is not None
    assert "Invalid characters detected" in info_space.validation_error

    # Empty URL
    info_empty = normalize_and_validate_url("")
    assert info_empty.is_valid is False
    assert info_empty.validation_error is not None
    assert "cannot be empty" in info_empty.validation_error

    # Missing TLD
    info_no_tld = normalize_and_validate_url("http://localhost-only")
    assert info_no_tld.is_valid is False
    assert info_no_tld.validation_error is not None
    assert "Top-level domain required" in info_no_tld.validation_error


# ============================================================================
# 3. Asset Type Classification Tests (Domain, Social, App Store)
# ============================================================================

def test_asset_classification_social_profiles():
    # Twitter / X
    info_x = normalize_and_validate_url("https://twitter.com/acme_official_support?utm_source=web")
    assert info_x.asset_type == "social_profile"
    assert info_x.platform == "Twitter / X"

    # LinkedIn
    info_li = normalize_and_validate_url("https://www.linkedin.com/company/acme-corp-phish")
    assert info_li.asset_type == "social_profile"
    assert info_li.platform == "LinkedIn"

    # Telegram
    info_tg = normalize_and_validate_url("https://t.me/acme_helpdesk")
    assert info_tg.asset_type == "social_profile"
    assert info_tg.platform == "Telegram"


def test_asset_classification_mobile_apps():
    # Google Play Store
    info_play = normalize_and_validate_url("https://play.google.com/store/apps/details?id=com.acme.banking")
    assert info_play.asset_type == "mobile_app"
    assert info_play.platform == "Google Play"
    # Preserves functional parameter 'id'
    assert "id=com.acme.banking" in info_play.normalized_url

    # Apple App Store
    info_apple = normalize_and_validate_url("https://apps.apple.com/us/app/acme-secure-app/id123456789")
    assert info_apple.asset_type == "mobile_app"
    assert info_apple.platform == "Apple App Store"


def test_asset_classification_standard_domains():
    info_web = normalize_and_validate_url("https://acme-phishing-login.xyz/auth")
    assert info_web.asset_type == "domain"
    assert info_web.platform == "Web"


# ============================================================================
# 4. Comparison with Official Registered Domains
# ============================================================================

def test_compare_candidate_domains_with_registered_official():
    official = ["acme-corp.com", "portal.acme-corp.com"]

    # 1. Exact match to official domain
    info_legit = normalize_and_validate_url("https://acme-corp.com/billing", official_domains=official)
    assert info_legit.is_official_match is True
    assert info_legit.matched_official_domain == "acme-corp.com"

    # 2. External / unverified candidate domain
    info_threat = normalize_and_validate_url("https://acme-corp-login.com/auth", official_domains=official)
    assert info_threat.is_official_match is False
    assert info_threat.matched_official_domain is None


# ============================================================================
# 5. Sample Data & Truth-in-Labeling Tests (Requirement 7 & 9)
# ============================================================================

def test_sample_candidates_explicitly_labeled_as_not_live():
    """
    Requirement 9: Never claim that live monitoring is active when using sample data.
    """
    samples = generate_sample_candidates(
        brand_name="CyberSentinel",
        official_domain="cybersentinel.com",
        limit=5,
    )

    assert len(samples) > 0
    for cand in samples:
        # Strict requirement 9 assertions:
        assert cand.is_live_monitoring is False
        assert cand.monitoring_mode == "simulated_sample"
        assert cand.notice == DISCLAIMER_SAMPLE_DATA
        assert cand.evidence.get("is_sample_data") is True
        assert cand.url.startswith("http")
        assert cand.asset_type in ("domain", "social_profile", "mobile_app")


# ============================================================================
# 6. Error & Provider Timeout Handling Tests (Requirement 8)
# ============================================================================

def test_live_provider_timeout_gracefully_falls_back():
    """
    Requirement 8: Handle timeouts gracefully without crashing.
    """
    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Connection timed out")):
        records, is_fallback, reason = fetch_live_provider_candidates(
            query_domain="acme.com",
            service_url="http://mock-provider.internal/scan",
            timeout=1.0,
        )

        assert is_fallback is True
        assert reason is not None
        assert "timed out" in reason.lower()
        assert len(records) == 0


def test_live_provider_rate_limit_gracefully_falls_back():
    """
    Requirement 8: Handle HTTP 429 rate limits gracefully.
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 429

    with patch("httpx.Client.post", return_value=mock_resp):
        records, is_fallback, reason = fetch_live_provider_candidates(
            query_domain="acme.com",
            service_url="http://mock-provider.internal/scan",
        )

        assert is_fallback is True
        assert reason is not None
        assert "rate limit exceeded" in reason.lower()
        assert "429" in reason


# ============================================================================
# 7. Database Persistence Tests (Requirement 10)
# ============================================================================

def test_monitoring_collection_persists_to_database(db_session):
    company = Company(name="FinShield Technologies", domain="finshield.com")
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    response = collect_monitoring_candidates(
        company_id=company.id,
        persist_to_database=True,
        limit=4,
        db=db_session,
    )

    assert response.total_collected == 4
    assert response.persisted_count == 4
    assert response.is_live_monitoring is False
    assert response.monitoring_mode == "simulated_sample"

    # Verify records in database
    db_cands = db_session.query(Candidate).filter(Candidate.company_id == company.id).all()
    assert len(db_cands) == 4
    for cand in db_cands:
        assert cand.value.startswith("http")
        assert cand.asset_type in ("domain", "social_profile", "mobile_app")
        assert cand.status == "pending"


# ============================================================================
# 8. Integration with Task 2 Brand Impersonation (Requirement 10)
# ============================================================================

def test_monitoring_candidates_integrate_with_task_2_brand_detection():
    """
    Connect monitoring output with Task 2 AI Brand Detection.
    """
    samples = generate_sample_candidates(
        brand_name="Acme Corp",
        official_domain="acme-corp.com",
        limit=6,
    )

    # Pick the combosquatting credential harvesting candidate
    threat_cand = next(
        (c for c in samples if "login" in c.url and c.asset_type == "domain"),
        None,
    )
    assert threat_cand is not None

    # Run Task 2 Brand Impersonation Detection on monitored candidate
    detection = evaluate_brand_impersonation(
        candidate_name="Acme Login",
        candidate_domain=threat_cand.url,
        official_brand_names=["Acme Corp"],
        official_domains=["acme-corp.com"],
        context_indicators=["active_dns"],
    )

    assert detection.is_domain_variation is True
    assert detection.risk_score >= 45.0
    assert detection.severity in ("MEDIUM", "HIGH", "CRITICAL")
    assert any("credential-harvesting" in r.lower() for r in detection.reasons)


# ============================================================================
# 9. API Endpoints Integration Tests
# ============================================================================

def test_monitoring_api_validate_url_endpoint(client, db_session):
    comp = Company(name="VeriSecure", domain="verisecure.com")
    db_session.add(comp)
    db_session.commit()

    # 1. Valid external candidate URL
    res = client.post(
        "/api/v1/monitoring/validate-url",
        json={
            "url": "https://verisecure-login.xyz/auth?utm_source=twitter&ref=feed",
            "company_id": comp.id,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["asset_type"] == "domain"
    assert data["is_official_match"] is False
    assert "utm_source" not in data["url_info"]["normalized_url"]

    # 2. Legitimate official URL
    res_legit = client.post(
        "/api/v1/monitoring/validate-url",
        json={
            "url": "https://verisecure.com/dashboard",
            "company_id": comp.id,
        },
    )
    assert res_legit.status_code == 200
    data_legit = res_legit.json()
    assert data_legit["is_official_match"] is True
    assert data_legit["matched_official_domain"] == "verisecure.com"


def test_monitoring_api_collect_endpoint(client, db_session):
    comp = Company(name="AlphaSec", domain="alphasec.io")
    db_session.add(comp)
    db_session.commit()

    res = client.post(
        "/api/v1/monitoring/collect",
        json={
            "company_id": comp.id,
            "persist_to_database": True,
            "limit": 5,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_collected"] == 5
    assert data["persisted_count"] == 5
    assert data["is_live_monitoring"] is False
    assert data["monitoring_mode"] == "simulated_sample"
    assert len(data["candidates"]) == 5


def test_monitoring_api_status_endpoint(client):
    res = client.get("/api/v1/monitoring/status")
    assert res.status_code == 200
    data = res.json()
    assert data["service_status"] == "operational"
    assert "domain" in data["supported_asset_types"]
    assert "social_profile" in data["supported_asset_types"]
    assert "mobile_app" in data["supported_asset_types"]
