import pytest
from app.models import Company, ProtectedAsset, Candidate, RiskFinding


def test_health_check_endpoint(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "digital-risk-protection-backend"
    assert "version" in data


# ============================================================================
# 1. Companies Endpoints
# ============================================================================

def test_company_endpoints_crud_and_validation(client):
    # 1. POST /api/v1/companies (201 Created)
    payload = {
        "name": "Apex Cyber Defense",
        "domain": "apexcyber.com",
        "industry": "Cybersecurity",
        "description": "SOC and Incident Response provider",
    }
    create_res = client.post("/api/v1/companies", json=payload)
    assert create_res.status_code == 201
    comp_data = create_res.json()
    assert comp_data["id"] is not None
    assert comp_data["name"] == payload["name"]
    company_id = comp_data["id"]

    # 2. Duplicate company name -> 400 Bad Request
    dup_res = client.post("/api/v1/companies", json=payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 3. Invalid payload (empty name) -> 422 Unprocessable Entity
    invalid_res = client.post("/api/v1/companies", json={"name": ""})
    assert invalid_res.status_code == 422

    # 4. GET /api/v1/companies (list and filter)
    list_res = client.get("/api/v1/companies", params={"name": "Apex", "industry": "Cybersecurity"})
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(c["id"] == company_id for c in items)

    # 5. GET /api/v1/companies/{company_id} (success)
    get_res = client.get(f"/api/v1/companies/{company_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == payload["name"]

    # 6. GET /api/v1/companies/{company_id} (missing ID -> 404)
    missing_res = client.get("/api/v1/companies/888777")
    assert missing_res.status_code == 404


# ============================================================================
# 2. Protected Assets Endpoints
# ============================================================================

def test_protected_assets_endpoints(client):
    # Setup company
    comp_res = client.post("/api/v1/companies", json={"name": "Sentinel Org", "domain": "sentinel.org"})
    assert comp_res.status_code == 201
    company_id = comp_res.json()["id"]

    # 1. POST /api/v1/assets (201 Created)
    asset_payload = {
        "company_id": company_id,
        "asset_type": "domain",
        "value": "sentinel.org",
        "platform": "web",
        "criticality": "HIGH",
    }
    create_res = client.post("/api/v1/assets", json=asset_payload)
    assert create_res.status_code == 201
    asset_data = create_res.json()
    assert asset_data["id"] is not None
    assert asset_data["asset_type"] == "domain"
    asset_id = asset_data["id"]

    # 2. Missing parent company -> 404
    missing_parent_res = client.post("/api/v1/assets", json={
        "company_id": 999111,
        "asset_type": "domain",
        "value": "fake.org",
    })
    assert missing_parent_res.status_code == 404

    # 3. Invalid asset_type -> 422
    invalid_type_res = client.post("/api/v1/assets", json={
        "company_id": company_id,
        "asset_type": "invalid_type",
        "value": "fake.org",
    })
    assert invalid_type_res.status_code == 422

    # 4. GET /api/v1/assets with filters
    list_res = client.get("/api/v1/assets", params={
        "company_id": company_id,
        "asset_type": "domain",
        "criticality": "HIGH",
    })
    assert list_res.status_code == 200
    assets = list_res.json()
    assert len(assets) >= 1
    assert any(a["id"] == asset_id for a in assets)

    # 5. GET /api/v1/assets/{asset_id} (success)
    get_res = client.get(f"/api/v1/assets/{asset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["value"] == "sentinel.org"

    # 6. GET /api/v1/assets/{asset_id} (missing ID -> 404)
    missing_res = client.get("/api/v1/assets/999111")
    assert missing_res.status_code == 404


# ============================================================================
# 3. Candidates Endpoints
# ============================================================================

def test_candidates_endpoints(client):
    # Setup company and asset
    comp = client.post("/api/v1/companies", json={"name": "Fortress Ltd", "domain": "fortress.net"}).json()
    company_id = comp["id"]
    asset = client.post("/api/v1/assets", json={
        "company_id": company_id,
        "asset_type": "brand_name",
        "value": "Fortress",
    }).json()
    asset_id = asset["id"]

    # 1. POST /api/v1/candidates (201 Created)
    cand_payload = {
        "company_id": company_id,
        "asset_id": asset_id,
        "asset_type": "domain",
        "value": "https://fortress-login-verify.com",
        "platform": "web",
        "source": "OSINT_MONITOR",
        "candidate_type": "TYPOSQUAT",
        "status": "pending",
        "confidence_score": 0.85,
        "observed_metadata": {"ip": "198.51.100.55", "nameserver": "ns1.badns.com"},
    }
    create_res = client.post("/api/v1/candidates", json=cand_payload)
    assert create_res.status_code == 201
    cand_data = create_res.json()
    assert cand_data["id"] is not None
    candidate_id = cand_data["id"]

    # 2. Missing company ID -> 404
    missing_comp_res = client.post("/api/v1/candidates", json={
        "company_id": 999222,
        "asset_type": "domain",
        "value": "https://fake.com",
    })
    assert missing_comp_res.status_code == 404

    # 3. Invalid asset_type -> 422
    invalid_res = client.post("/api/v1/candidates", json={
        "company_id": company_id,
        "asset_type": "unsupported_type",
        "value": "https://fake.com",
    })
    assert invalid_res.status_code == 422

    # 4. GET /api/v1/candidates (filtering)
    list_res = client.get("/api/v1/candidates", params={
        "company_id": company_id,
        "status": "pending",
        "source": "OSINT_MONITOR",
    })
    assert list_res.status_code == 200
    candidates = list_res.json()
    assert any(c["id"] == candidate_id for c in candidates)

    # 5. GET /api/v1/candidates/{candidate_id} (success)
    get_res = client.get(f"/api/v1/candidates/{candidate_id}")
    assert get_res.status_code == 200
    assert get_res.json()["value"] == cand_payload["value"]

    # 6. GET /api/v1/candidates/{candidate_id} (missing ID -> 404)
    missing_res = client.get("/api/v1/candidates/999222")
    assert missing_res.status_code == 404


# ============================================================================
# 4. Findings Endpoints (with Pagination)
# ============================================================================

def test_findings_endpoints_and_pagination(client):
    # Setup company
    comp = client.post("/api/v1/companies", json={"name": "Vanguard Security", "domain": "vanguard.sec"}).json()
    company_id = comp["id"]

    # Create multiple findings for pagination testing
    for i in range(5):
        finding_payload = {
            "company_id": company_id,
            "title": f"Threat #{i}",
            "risk_score": 50.0 + (i * 10),
            "severity": "high" if i % 2 == 0 else "critical",
            "status": "pending" if i < 3 else "completed",
            "reasons": [f"Suspicious activity #{i}"],
            "evidence": {"attempt": i},
        }
        f_res = client.post("/api/v1/findings", json=finding_payload)
        assert f_res.status_code == 201

    # 1. GET /api/v1/findings (list with pagination headers)
    list_res = client.get("/api/v1/findings", params={"company_id": company_id, "limit": 2, "page": 1})
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 2
    assert "X-Total-Count" in list_res.headers
    assert int(list_res.headers["X-Total-Count"]) >= 5
    assert list_res.headers["X-Page"] == "1"

    # Second page
    page2_res = client.get("/api/v1/findings", params={"company_id": company_id, "limit": 2, "page": 2})
    assert page2_res.status_code == 200
    items_p2 = page2_res.json()
    assert len(items_p2) == 2
    assert items[0]["id"] != items_p2[0]["id"]

    # 2. Filter by severity
    crit_res = client.get("/api/v1/findings", params={"company_id": company_id, "severity": "critical"})
    assert crit_res.status_code == 200
    crit_findings = crit_res.json()
    assert all(f["severity"].lower() == "critical" for f in crit_findings)

    # 3. Filter by status
    pend_res = client.get("/api/v1/findings", params={"company_id": company_id, "status": "pending"})
    assert pend_res.status_code == 200
    pend_findings = pend_res.json()
    assert all(f["status"].lower() == "pending" for f in pend_findings)

    # 4. GET /api/v1/findings/{finding_id}
    finding_id = items[0]["id"]
    get_res = client.get(f"/api/v1/findings/{finding_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == finding_id

    # 5. Missing ID -> 404
    missing_res = client.get("/api/v1/findings/999333")
    assert missing_res.status_code == 404


# ============================================================================
# 5. Analysis Endpoint (POST /api/v1/analyze)
# ============================================================================

def test_analyze_endpoint(client):
    # Setup company and asset
    comp = client.post("/api/v1/companies", json={"name": "Aegis Corporation", "domain": "aegis.com"}).json()
    company_id = comp["id"]
    asset = client.post("/api/v1/assets", json={
        "company_id": company_id,
        "asset_type": "domain",
        "value": "aegis.com",
    }).json()
    asset_id = asset["id"]

    # 1. Successful Analysis
    analyze_payload = {
        "company_id": company_id,
        "asset_id": asset_id,
        "candidate_type": "CREDENTIAL_LEAK",
        "source": "DARK_WEB_SCRAPER",
        "raw_data": "aws_secret_key leaked in public paste",
        "threat_indicators": ["active", "exposed_secret"],
    }
    res = client.post("/api/v1/analyze", json=analyze_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["company_id"] == company_id
    assert data["company_name"] == "Aegis Corporation"
    assert data["recommended_severity"] == "CRITICAL"
    assert data["estimated_risk_score"] > 80.0
    assert data["confidence_score"] > 0.8
    assert data["should_convert_to_finding"] is True
    assert "remediation" in data["recommended_remediation"].lower() or len(data["recommended_remediation"]) > 0

    # 2. Missing Company ID -> 404
    missing_comp_res = client.post("/api/v1/analyze", json={
        "company_id": 999444,
        "candidate_type": "PHISHING",
        "source": "SCANNER",
    })
    assert missing_comp_res.status_code == 404

    # 3. Missing Asset ID -> 404
    missing_asset_res = client.post("/api/v1/analyze", json={
        "company_id": company_id,
        "asset_id": 999444,
        "candidate_type": "PHISHING",
        "source": "SCANNER",
    })
    assert missing_asset_res.status_code == 404

    # 4. Invalid input (company_id <= 0) -> 422
    invalid_res = client.post("/api/v1/analyze", json={
        "company_id": -5,
        "candidate_type": "PHISHING",
    })
    assert invalid_res.status_code == 422
