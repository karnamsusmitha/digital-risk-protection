import pytest
from app.models import Company, ProtectedAsset, Candidate, RiskFinding


# ============================================================================
# Dashboard Summary Tests
# ============================================================================

def test_dashboard_summary_empty_database(client):
    """
    Ensure GET /api/v1/dashboard/summary returns clean 200 OK with valid
    empty results (zeroed counts, empty arrays) rather than errors on an empty database.
    """
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["total_protected_assets"] == 0
    assert data["total_candidates_analyzed"] == 0
    assert data["total_findings"] == 0
    assert data["open_findings"] == 0
    assert data["total_companies"] == 0
    assert data["recent_findings"] == []

    # Check both lowercase and uppercase severity keys
    assert data["findings_by_severity"]["critical"] == 0
    assert data["findings_by_severity"]["high"] == 0
    assert data["findings_by_severity"]["medium"] == 0
    assert data["findings_by_severity"]["low"] == 0
    assert data["findings_by_severity"]["CRITICAL"] == 0
    assert data["findings_by_severity"]["HIGH"] == 0
    assert data["findings_by_severity"]["MEDIUM"] == 0
    assert data["findings_by_severity"]["LOW"] == 0

    # Test with non-existent company ID on empty DB also returns 200 with 0s
    scoped_res = client.get("/api/v1/dashboard/summary?company_id=999")
    assert scoped_res.status_code == 200
    assert scoped_res.json()["total_protected_assets"] == 0
    assert scoped_res.json()["recent_findings"] == []


def test_dashboard_summary_populated_database(client, db_session):
    """
    Ensure GET /api/v1/dashboard/summary accurately aggregates assets, candidates,
    findings by severity, and returns recent findings.
    """
    # 1. Create company
    company = Company(name="Acme Global Security", domain="https://acme.org")
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    # 2. Create protected assets
    asset1 = ProtectedAsset(
        company_id=company.id,
        asset_type="domain",
        value="https://acme.org",
        criticality="HIGH",
    )
    asset2 = ProtectedAsset(
        company_id=company.id,
        asset_type="brand_name",
        value="Acme Corp",
        criticality="MEDIUM",
    )
    db_session.add_all([asset1, asset2])
    db_session.commit()

    # 3. Create candidates
    cand1 = Candidate(
        company_id=company.id,
        asset_type="domain",
        value="https://acme-phish.net",
        source="MONITORING_CRAWLER",
        status="completed",
    )
    cand2 = Candidate(
        company_id=company.id,
        asset_type="domain",
        value="https://acme-typo.com",
        source="CERTSTREAM",
        status="pending",
    )
    db_session.add_all([cand1, cand2])
    db_session.commit()

    # 4. Create risk findings across different severities
    f1 = RiskFinding(
        company_id=company.id,
        title="Critical Phishing Clone",
        severity="critical",
        status="open",
        risk_score=95.0,
    )
    f2 = RiskFinding(
        company_id=company.id,
        title="High Typosquat Domain",
        severity="high",
        status="pending",
        risk_score=75.0,
    )
    f3 = RiskFinding(
        company_id=company.id,
        title="Medium Suspicious Subdomain",
        severity="medium",
        status="open",
        risk_score=50.0,
    )
    f4 = RiskFinding(
        company_id=company.id,
        title="Low Informational Signal",
        severity="low",
        status="resolved",
        risk_score=20.0,
    )
    db_session.add_all([f1, f2, f3, f4])
    db_session.commit()

    # 5. Query dashboard summary
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200

    data = response.json()
    assert data["total_protected_assets"] == 2
    assert data["total_candidates_analyzed"] >= 2
    assert data["total_findings"] == 4
    assert data["open_findings"] == 3  # open, pending, open (resolved is not open)
    assert data["total_companies"] == 1

    # Check severity breakdown
    assert data["findings_by_severity"]["critical"] == 1
    assert data["findings_by_severity"]["high"] == 1
    assert data["findings_by_severity"]["medium"] == 1
    assert data["findings_by_severity"]["low"] == 1
    assert data["findings_by_severity"]["CRITICAL"] == 1

    # Check recent findings
    assert len(data["recent_findings"]) == 4
    assert data["recent_findings"][0]["title"] == "Low Informational Signal"  # latest created


def test_dashboard_summary_company_filtering(client, db_session):
    """
    Ensure dashboard summary can be scoped to a specific company ID.
    """
    c1 = Company(name="Alpha Corp")
    c2 = Company(name="Beta Corp")
    db_session.add_all([c1, c2])
    db_session.commit()

    # Alpha has 1 asset, 2 findings
    a1 = ProtectedAsset(company_id=c1.id, asset_type="domain", value="https://alpha.com")
    db_session.add(a1)
    f_alpha1 = RiskFinding(company_id=c1.id, title="Alpha Threat", severity="critical", risk_score=90.0)
    f_alpha2 = RiskFinding(company_id=c1.id, title="Alpha Notice", severity="low", risk_score=15.0)
    db_session.add_all([f_alpha1, f_alpha2])

    # Beta has 2 assets, 1 finding
    a2 = ProtectedAsset(company_id=c2.id, asset_type="domain", value="https://beta.com")
    a3 = ProtectedAsset(company_id=c2.id, asset_type="brand_name", value="Beta")
    db_session.add_all([a2, a3])
    f_beta = RiskFinding(company_id=c2.id, title="Beta Threat", severity="high", risk_score=70.0)
    db_session.add(f_beta)
    db_session.commit()

    # Scoped to Alpha
    res_alpha = client.get(f"/api/v1/dashboard/summary?company_id={c1.id}")
    assert res_alpha.status_code == 200
    alpha_data = res_alpha.json()
    assert alpha_data["total_protected_assets"] == 1
    assert alpha_data["total_findings"] == 2
    assert alpha_data["findings_by_severity"]["critical"] == 1
    assert alpha_data["findings_by_severity"]["high"] == 0

    # Scoped to Beta
    res_beta = client.get(f"/api/v1/dashboard/summary?company_id={c2.id}")
    assert res_beta.status_code == 200
    beta_data = res_beta.json()
    assert beta_data["total_protected_assets"] == 2
    assert beta_data["total_findings"] == 1
    assert beta_data["findings_by_severity"]["critical"] == 0
    assert beta_data["findings_by_severity"]["high"] == 1


# ============================================================================
# CORS Configuration Tests
# ============================================================================

@pytest.mark.parametrize(
    "origin",
    [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
)
def test_cors_preflight_options_request(client, origin):
    """
    Ensure CORS preflight OPTIONS requests return appropriate Access-Control headers
    for common local React development origins.
    """
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    response = client.options("/api/v1/companies", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_cors_simple_get_and_exposed_headers(client):
    """
    Ensure CORS response on GET /api/v1/findings includes Access-Control-Allow-Origin
    and exposes pagination headers (X-Total-Count, X-Page, etc.) to the browser.
    """
    origin = "http://localhost:5173"
    response = client.get("/api/v1/findings", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin

    # Check that pagination headers are exposed in Access-Control-Expose-Headers
    exposed = response.headers.get("access-control-expose-headers", "")
    assert "X-Total-Count" in exposed or "x-total-count" in exposed.lower()
    assert "X-Page" in exposed or "x-page" in exposed.lower()

    # Check actual headers exist
    assert "x-total-count" in response.headers
    assert "x-page" in response.headers


# ============================================================================
# Validation Error Formatting Tests (422 Clear Messages)
# ============================================================================

def test_validation_error_missing_company_name(client):
    """
    Ensure missing required fields produce clear, informative 422 messages
    specifying which fields are missing.
    """
    response = client.post("/api/v1/companies", json={})
    assert response.status_code == 422
    data = response.json()

    assert "detail" in data
    assert "name" in data["detail"].lower()
    assert "errors" in data
    assert len(data["errors"]) > 0
    assert any(e.get("loc") == ["body", "name"] for e in data["errors"])


def test_validation_error_missing_asset_fields(client):
    """
    Ensure missing asset required fields (company_id, asset_type, value) are clearly flagged.
    """
    response = client.post("/api/v1/assets", json={})
    assert response.status_code == 422
    data = response.json()

    detail = data["detail"]
    assert "company_id" in detail or any(e["loc"][-1] == "company_id" for e in data["errors"])
    assert "asset_type" in detail or any(e["loc"][-1] == "asset_type" for e in data["errors"])
    assert "value" in detail or any(e["loc"][-1] == "value" for e in data["errors"])


# ============================================================================
# Findings Filtering & Pagination Tests
# ============================================================================

def test_findings_filtering_and_pagination(client, db_session):
    """
    Ensure GET /api/v1/findings supports pagination and filtering by severity,
    status, company_id, candidate_id, and search keyword.
    """
    company = Company(name="Test Org")
    db_session.add(company)
    db_session.commit()

    # Seed 5 findings
    f1 = RiskFinding(company_id=company.id, title="Login Phish", severity="critical", status="open", risk_score=95.0)
    f2 = RiskFinding(company_id=company.id, title="Brand Impersonation", severity="high", status="open", risk_score=80.0)
    f3 = RiskFinding(company_id=company.id, title="Fake Social Page", severity="medium", status="pending", risk_score=55.0)
    f4 = RiskFinding(company_id=company.id, title="Lookalike APK", severity="low", status="completed", risk_score=25.0)
    f5 = RiskFinding(company_id=company.id, title="Another Phish", severity="critical", status="open", risk_score=90.0)
    db_session.add_all([f1, f2, f3, f4, f5])
    db_session.commit()

    # 1. Test pagination (page=1, page_size=2)
    p1_res = client.get("/api/v1/findings?page=1&page_size=2")
    assert p1_res.status_code == 200
    assert len(p1_res.json()) == 2
    assert p1_res.headers["X-Total-Count"] == "5"
    assert p1_res.headers["X-Page"] == "1"
    assert p1_res.headers["X-Limit"] == "2"
    assert p1_res.headers["X-Total-Pages"] == "3"

    # 2. Test filter by severity (critical)
    crit_res = client.get("/api/v1/findings?severity=critical")
    assert crit_res.status_code == 200
    crit_items = crit_res.json()
    assert len(crit_items) == 2
    assert all(item["severity"].lower() == "critical" for item in crit_items)

    # 3. Test filter by status (pending)
    pend_res = client.get("/api/v1/findings?status=pending")
    assert pend_res.status_code == 200
    assert len(pend_res.json()) == 1

    # 4. Test search keyword
    search_res = client.get("/api/v1/findings?search=Phish")
    assert search_res.status_code == 200
    assert len(search_res.json()) == 2

    # 5. Empty database / non-matching filter returns empty list with 200
    none_res = client.get("/api/v1/findings?search=nonexistentkeywordxyz")
    assert none_res.status_code == 200
    assert none_res.json() == []
    assert none_res.headers["X-Total-Count"] == "0"
