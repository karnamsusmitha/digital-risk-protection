"""
End-to-end integration tests verifying frontend workflows, CORS configuration,
schema stability, and error handling for frontend pair programming and UI integration.
"""

import pytest
from app.config import Settings


def test_cors_preflight_and_origin_headers(client):
    """
    Verify CORS configuration for frontend origins (e.g. Angular on port 4200).
    Preflight OPTIONS and standard GET/POST should return proper Access-Control headers.
    """
    # Preflight request from Angular development server
    preflight_res = client.options(
        "/api/brands",
        headers={
            "Origin": "http://localhost:4200",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
    )
    assert preflight_res.status_code == 200
    assert preflight_res.headers.get("access-control-allow-origin") == "http://localhost:4200"
    assert preflight_res.headers.get("access-control-allow-credentials") == "true"

    # Actual request from React/Vite development server on 3000
    get_res = client.get(
        "/api/brands",
        headers={"Origin": "http://localhost:3000"}
    )
    assert get_res.status_code == 200
    assert get_res.headers.get("access-control-allow-origin") == "http://localhost:3000"

    # Unallowed third-party origin should NOT receive allow header
    untrusted_res = client.get(
        "/api/brands",
        headers={"Origin": "http://untrusted-attacker-site.evil"}
    )
    assert untrusted_res.headers.get("access-control-allow-origin") is None


def test_cors_production_forbids_wildcard(monkeypatch):
    """Verify that in production mode, wildcard '*' is automatically stripped and disallowed."""
    monkeypatch.setenv("APP_ENV", "production")
    s = Settings(
        APP_ENV="production",
        CORS_ORIGINS=["https://app.drp.com", "*"]
    )
    assert "*" not in s.CORS_ORIGINS
    assert "https://app.drp.com" in s.CORS_ORIGINS


def test_frontend_brand_registration_and_listing(client):
    """
    Verify frontend workflow:
    1. Register a new brand with official assets.
    2. View registered brands list with pagination and search.
    3. Retrieve brand by ID.
    """
    # 1. Register brand
    create_res = client.post("/api/brands", json={
        "name": "Acme Cloud Corp",
        "description": "Enterprise cloud security provider",
        "official_domains": ["acmecloud.com", "acme-portal.net"],
        "official_urls": ["https://acmecloud.com/login"],
        "official_social_handles": ["@acmecloud"]
    })
    assert create_res.status_code == 201
    brand = create_res.json()
    assert brand["id"] is not None
    assert brand["name"] == "Acme Cloud Corp"
    assert brand["official_domains"] == ["acmecloud.com", "acme-portal.net"]
    assert brand["created_at"] is not None

    # 2. View brand list
    list_res = client.get("/api/brands?limit=10&offset=0")
    assert list_res.status_code == 200
    brands = list_res.json()
    assert isinstance(brands, list)
    assert len(brands) >= 1
    assert any(b["id"] == brand["id"] for b in brands)

    # Search filter
    search_res = client.get("/api/brands?search=Acme")
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1

    # 3. Retrieve single brand
    get_res = client.get(f"/api/brands/{brand['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Acme Cloud Corp"


def test_frontend_candidate_submission_and_detailed_scoring(client):
    """
    Verify frontend workflow:
    1. Submit candidate for analysis.
    2. Display risk score, category, indicators, and recommended action.
    """
    # Setup brand
    brand_res = client.post("/api/brands", json={
        "name": "FinBank Global",
        "official_domains": ["finbankglobal.com"]
    })
    brand_id = brand_res.json()["id"]

    # Candidate typosquat with deceptive keywords
    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "finbankg1oba1-login-verify.xyz",
        "brand_id": brand_id
    })
    assert scan_res.status_code == 201
    data = scan_res.json()

    # Required fields for frontend display
    assert "risk_score" in data
    assert "risk_category" in data
    assert "indicators" in data
    assert "recommended_action" in data
    assert "evidence_source" in data
    assert "explanations" in data

    assert data["risk_score"] >= 75
    assert data["risk_category"] == "Critical"
    assert "Immediate triage" in data["recommended_action"]
    assert isinstance(data["indicators"], list)
    assert len(data["indicators"]) >= 2

    # Check indicator contract
    for ind in data["indicators"]:
        assert "code" in ind
        assert "name" in ind
        assert "severity" in ind
        assert "score_impact" in ind
        assert "explanation" in ind


def test_frontend_tolerant_candidate_asset_type_aliases(client):
    """
    Ensure frontend can pass asset type aliases without validation errors:
    - 'social profile', 'social_profile', 'social_media_profile'
    - 'app listing', 'app_listing', 'mobile_app'
    """
    brand_res = client.post("/api/brands", json={"name": "Alias Brand"})
    brand_id = brand_res.json()["id"]

    # 'social profile' alias
    res_social = client.post("/api/scans", json={
        "candidate_type": "social profile",
        "candidate_value": "@alias_support_helpdesk",
        "brand_id": brand_id
    })
    assert res_social.status_code == 201
    assert res_social.json()["candidate_type"] == "social_media_profile"

    # 'app listing' alias
    res_app = client.post("/api/scans", json={
        "candidate_type": "app listing",
        "candidate_value": "Alias Brand Mod Crack",
        "brand_id": brand_id
    })
    assert res_app.status_code == 201
    assert res_app.json()["candidate_type"] == "mobile_app"


def test_frontend_scan_history_and_triage_flow(client):
    """
    Verify frontend scan history retrieval and triage status updating.
    """
    # Create two scans
    s1 = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "legitimate-news-reader.org"
    }).json()

    s2 = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "phishing-login-update-wallet.xyz"
    }).json()

    # List scans
    history_res = client.get("/api/scans?limit=20&offset=0")
    assert history_res.status_code == 200
    scans = history_res.json()
    assert isinstance(scans, list)
    assert len(scans) >= 2

    # Filter by category
    crit_res = client.get("/api/scans?category=Critical")
    assert crit_res.status_code == 200

    # Update triage status
    patch_res = client.patch(f"/api/scans/{s2['id']}/status", json={
        "status": "confirmed_threat"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "confirmed_threat"


def test_frontend_dashboard_summary_metrics(client):
    """
    Verify dashboard summary endpoint returns all counts and review queues needed by the UI.
    """
    # Register brand and scans
    brand = client.post("/api/brands", json={"name": "Metrics Brand"}).json()
    client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "metrics-fans.org",
        "brand_id": brand["id"]
    })
    client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "metricsbrand-login-security.xyz",
        "brand_id": brand["id"]
    })

    dash_res = client.get("/api/dashboard/summary")
    assert dash_res.status_code == 200
    summary = dash_res.json()

    # Verify structured dashboard metrics
    assert "total_brands" in summary
    assert "total_scans" in summary
    assert "risk_distribution" in summary
    assert "status_distribution" in summary
    assert "type_distribution" in summary
    assert "recent_scans" in summary
    assert "findings_needing_review" in summary

    assert summary["total_brands"] >= 1
    assert summary["total_scans"] >= 2
    assert "Low" in summary["risk_distribution"]
    assert "Critical" in summary["risk_distribution"]
    assert "completed" in summary["status_distribution"]
    assert "review_needed" in summary["status_distribution"]


def test_frontend_error_handling_and_validation(client):
    """
    Verify backend handles missing/malformed fields gracefully with friendly error messages.
    """
    # 1. Missing required field in brand creation (no name)
    empty_brand_res = client.post("/api/brands", json={})
    assert empty_brand_res.status_code == 422
    data = empty_brand_res.json()
    assert "detail" in data
    assert "name" in data["detail"].lower()

    # 2. Blank brand name string
    blank_name_res = client.post("/api/brands", json={"name": "   "})
    assert blank_name_res.status_code == 422
    assert "cannot be blank" in blank_name_res.json()["detail"]

    # 3. Duplicate brand name (409 Conflict)
    client.post("/api/brands", json={"name": "Unique Name Corp"})
    dup_res = client.post("/api/brands", json={"name": "Unique Name Corp"})
    assert dup_res.status_code == 409
    assert "already registered" in dup_res.json()["detail"]

    # 4. Tolerant null fields in brand creation (e.g. from empty frontend form fields)
    tolerant_res = client.post("/api/brands", json={
        "name": "Tolerant Brand",
        "official_domains": None,
        "official_urls": None,
        "official_social_handles": None
    })
    assert tolerant_res.status_code == 201
    assert tolerant_res.json()["official_domains"] == []

    # 5. Nonexistent brand ID in scan submission (404 Not Found)
    missing_b_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "test.com",
        "brand_id": 99999
    })
    assert missing_b_res.status_code == 404
    assert "not found" in missing_b_res.json()["detail"].lower()

    # 6. Invalid URL scheme (400 Bad Request)
    bad_url_res = client.post("/api/scans", json={
        "candidate_type": "url",
        "candidate_value": "javascript:stealCookies()"
    })
    assert bad_url_res.status_code == 400
    assert "Unsupported or unsafe URL scheme" in bad_url_res.json()["detail"]

    # 7. Non-existent brand detail endpoint (404 Not Found)
    not_found_b = client.get("/api/brands/99999")
    assert not_found_b.status_code == 404
    assert "not found" in not_found_b.json()["detail"].lower()

    # 8. Non-existent scan detail endpoint (404 Not Found)
    not_found_s = client.get("/api/scans/99999")
    assert not_found_s.status_code == 404
    assert "not found" in not_found_s.json()["detail"].lower()
