import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Company, ProtectedAsset, Candidate, RiskFinding
from app.database import Base


# ============================================================================
# Audit Test 1: Application Startup without AI Credentials
# ============================================================================

def test_audit_01_application_startup_without_ai_credentials():
    """
    Audit 1: Verify the backend starts up cleanly and does not require
    live AI or monitoring credentials in the environment.
    """
    from app.config import settings
    from app.main import app, lifespan

    # Verify default config does not mandate AI credentials
    assert settings.AI_MODULE_URL is None or isinstance(settings.AI_MODULE_URL, str)
    assert settings.AI_MODULE_API_KEY is None or isinstance(settings.AI_MODULE_API_KEY, str)

    # Lifespan context manager execution (startup -> yield -> shutdown)
    import asyncio

    async def run_lifespan():
        async with lifespan(app):
            assert app.title == settings.APP_NAME

    asyncio.run(run_lifespan())


# ============================================================================
# Audit Test 2: GET /health
# ============================================================================

def test_audit_02_get_health(client):
    """
    Audit 2: GET /health endpoint returns healthy status and service version.
    """
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "digital-risk-protection-backend"
    assert data["version"] == "1.0.0"
    assert "timestamp" in data


# ============================================================================
# Audit Test 3: Company Registration and Retrieval
# ============================================================================

def test_audit_03_company_registration_and_retrieval(client):
    """
    Audit 3: POST /api/v1/companies, GET /api/v1/companies, GET /api/v1/companies/{id}.
    """
    # 1. Create company
    create_res = client.post("/api/v1/companies", json={
        "name": "Audit Monitored Corp",
        "domain": "https://audit-corp.com",
        "industry": "Cybersecurity",
        "description": "Monitored company under QA audit",
    })
    assert create_res.status_code == 201
    comp = create_res.json()
    comp_id = comp["id"]
    assert comp["name"] == "Audit Monitored Corp"
    assert comp["domain"] == "https://audit-corp.com"

    # 2. List companies
    list_res = client.get("/api/v1/companies")
    assert list_res.status_code == 200
    assert any(c["id"] == comp_id for c in list_res.json())

    # 3. Get single company
    get_res = client.get(f"/api/v1/companies/{comp_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Audit Monitored Corp"

    # 4. Non-existent company -> 404
    missing_res = client.get("/api/v1/companies/999999")
    assert missing_res.status_code == 404


# ============================================================================
# Audit Test 4: Protected Asset Registration and Retrieval
# ============================================================================

def test_audit_04_protected_asset_registration_and_retrieval(client):
    """
    Audit 4: POST /api/v1/assets, GET /api/v1/assets, GET /api/v1/assets/{id}.
    """
    comp_res = client.post("/api/v1/companies", json={"name": "Asset Audit Corp"})
    comp_id = comp_res.json()["id"]

    # 1. Register asset
    asset_res = client.post("/api/v1/assets", json={
        "company_id": comp_id,
        "asset_type": "domain",
        "value": "https://audit-corp-portal.com",
        "name": "Main Portal",
        "criticality": "HIGH",
    })
    assert asset_res.status_code == 201
    asset = asset_res.json()
    asset_id = asset["id"]
    assert asset["criticality"] == "HIGH"

    # 2. List assets
    list_res = client.get(f"/api/v1/assets?company_id={comp_id}")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Get single asset
    get_res = client.get(f"/api/v1/assets/{asset_id}")
    assert get_res.status_code == 200
    assert get_res.json()["value"] == "https://audit-corp-portal.com"

    # 4. Non-existent asset -> 404
    missing_res = client.get("/api/v1/assets/999999")
    assert missing_res.status_code == 404


# ============================================================================
# Audit Test 5: Candidate Registration, Retrieval and Conversion
# ============================================================================

def test_audit_05_candidate_registration_and_retrieval(client):
    """
    Audit 5: POST /api/v1/candidates, GET /api/v1/candidates, candidate triage.
    """
    comp_res = client.post("/api/v1/companies", json={"name": "Candidate Audit Corp"})
    comp_id = comp_res.json()["id"]

    # 1. Register candidate
    cand_res = client.post("/api/v1/candidates", json={
        "company_id": comp_id,
        "asset_type": "domain",
        "value": "https://audit-corp-fake-login.com",
        "source": "SCANNER_MODULE",
        "candidate_type": "phishing_domain",
        "confidence_score": 0.82,
        "status": "pending",
    })
    assert cand_res.status_code == 201
    cand_id = cand_res.json()["id"]

    # 2. Retrieve candidate
    get_res = client.get(f"/api/v1/candidates/{cand_id}")
    assert get_res.status_code == 200
    assert get_res.json()["confidence_score"] == 0.82

    # 3. Convert candidate to finding
    convert_res = client.post(f"/api/v1/candidates/{cand_id}/convert-to-finding")
    assert convert_res.status_code == 201
    finding_data = convert_res.json()
    assert finding_data["candidate_id"] == cand_id
    assert finding_data["company_id"] == comp_id


# ============================================================================
# Audit Test 6: Risk Analysis and Finding Persistence
# ============================================================================

def test_audit_06_risk_analysis_and_finding_persistence(client, db_session):
    """
    Audit 6: POST /api/v1/analyze calculates explainable score, severity,
    reasons, evidence, and persists RiskFinding into the database.
    """
    comp = Company(name="Threat Analysis Corp", domain="https://threat-corp.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    payload = {
        "company_id": comp.id,
        "candidate_name": "threat-corp-security-login",
        "domain": "https://threat-corp-security-login.com",
        "source": "AI_VISION_MODULE",
        "ai_evidence": {
            "name_similarity": 0.94,
            "logo_similarity": 0.90,
            "model_name": "drp-brand-vision-v2",
            "model_confidence": 0.95,
        },
        "monitoring_evidence": {
            "candidate_url": "https://threat-corp-security-login.com/auth",
            "asset_type": "domain",
            "platform": "Web",
            "source_identifier": "SCANNER_FEED",
        },
        "deduplicate": True,
    }

    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["company_id"] == comp.id
    assert data["recommended_severity"].lower() in ("critical", "high")
    assert 0.0 <= data["estimated_risk_score"] <= 100.0
    assert len(data["reasons"]) > 0
    assert data["finding_id"] is not None
    assert data["should_convert_to_finding"] is True

    # Verify persistence in database
    persisted = db_session.query(RiskFinding).filter(RiskFinding.id == data["finding_id"]).first()
    assert persisted is not None
    assert persisted.company_id == comp.id
    assert persisted.severity == data["recommended_severity"].lower()


# ============================================================================
# Audit Test 7: Official-Asset Exclusion
# ============================================================================

def test_audit_07_official_asset_exclusion(client, db_session):
    """
    Audit 7: When an inspected target matches an official registered company asset,
    it must be excluded from suspicious threats and marked is_official_asset_match=True.
    """
    comp = Company(name="Exclusion Corp", domain="https://official-exclusion.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    official_asset = ProtectedAsset(
        company_id=comp.id,
        asset_type="domain",
        value="https://official-exclusion.com",
        criticality="HIGH",
    )
    db_session.add(official_asset)
    db_session.commit()

    # Analyze official asset
    payload = {
        "company_id": comp.id,
        "asset_id": official_asset.id,
        "domain": "https://official-exclusion.com",
        "source": "CRAWLER",
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["is_official_asset_match"] is True
    assert data["recommended_severity"].lower() == "low"
    assert data["estimated_risk_score"] == 0.0
    assert data["status"] == "resolved"


# ============================================================================
# Audit Test 8: Risk Score Bounds and Severity Mapping
# ============================================================================

def test_audit_08_risk_score_bounds_and_severity_mapping(client, db_session):
    """
    Audit 8: Risk scores must be bounded strictly between 0 and 100,
    and mapped deterministically to Low, Medium, High, or Critical.
    """
    from app.services.risk_scoring import map_score_to_severity, calculate_finding_score

    # Check default thresholds mapping: CRITICAL >= 80, HIGH >= 60, MEDIUM >= 35, LOW < 35
    assert map_score_to_severity(0.0) == "LOW"
    assert map_score_to_severity(30.0) == "LOW"
    assert map_score_to_severity(45.0) == "MEDIUM"
    assert map_score_to_severity(70.0) == "HIGH"
    assert map_score_to_severity(85.0) == "CRITICAL"
    assert map_score_to_severity(100.0) == "CRITICAL"

    # Check finding score calculation bounds across all combinations
    for sev in ("low", "medium", "high", "critical"):
        for crit in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
            score = calculate_finding_score(sev, crit)
            assert 0.0 <= score <= 100.0


# ============================================================================
# Audit Test 9: Invalid Payloads and Missing IDs
# ============================================================================

def test_audit_09_invalid_payloads_and_missing_ids(client):
    """
    Audit 9: Clear 422 for missing required fields, 404 for missing parent IDs.
    """
    # Missing required field in company registration
    res1 = client.post("/api/v1/companies", json={})
    assert res1.status_code == 422
    assert "detail" in res1.json()
    assert "name" in res1.json()["detail"].lower()

    # Missing parent company_id for asset registration -> 404
    res2 = client.post("/api/v1/assets", json={
        "company_id": 999999,
        "asset_type": "domain",
        "value": "https://orphan-asset.com",
    })
    assert res2.status_code == 404
    assert "does not exist" in res2.json()["detail"]

    # Invalid asset type -> 422
    res3 = client.post("/api/v1/assets", json={
        "company_id": 1,
        "asset_type": "invalid_unsupported_type",
        "value": "https://test.com",
    })
    assert res3.status_code == 422


# ============================================================================
# Audit Test 10: Findings Filtering and Pagination
# ============================================================================

def test_audit_10_findings_filtering_and_pagination(client, db_session):
    """
    Audit 10: Filtering by severity, status, company_id, and response pagination headers.
    """
    comp = Company(name="Filter Audit Org")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    f_crit = RiskFinding(company_id=comp.id, title="Crit", severity="critical", status="open", risk_score=95.0)
    f_high = RiskFinding(company_id=comp.id, title="High", severity="high", status="open", risk_score=75.0)
    f_low = RiskFinding(company_id=comp.id, title="Low", severity="low", status="completed", risk_score=20.0)
    db_session.add_all([f_crit, f_high, f_low])
    db_session.commit()

    # Pagination test
    res = client.get(f"/api/v1/findings?company_id={comp.id}&page=1&page_size=2")
    assert res.status_code == 200
    assert len(res.json()) == 2
    assert res.headers["X-Total-Count"] == "3"
    assert res.headers["X-Total-Pages"] == "2"

    # Severity filter test
    res_crit = client.get(f"/api/v1/findings?company_id={comp.id}&severity=critical")
    assert res_crit.status_code == 200
    assert len(res_crit.json()) == 1
    assert res_crit.json()[0]["severity"].lower() == "critical"


# ============================================================================
# Audit Test 11: Dashboard Summary
# ============================================================================

def test_audit_11_dashboard_summary(client, db_session):
    """
    Audit 11: GET /api/v1/dashboard/summary returns total assets, candidates,
    findings by severity, and recent findings. Safe on empty DB.
    """
    # Empty DB
    empty_res = client.get("/api/v1/dashboard/summary")
    assert empty_res.status_code == 200
    empty_data = empty_res.json()
    assert empty_data["total_protected_assets"] == 0
    assert empty_data["total_candidates_analyzed"] == 0
    assert empty_data["recent_findings"] == []
    assert empty_data["findings_by_severity"]["critical"] == 0


# ============================================================================
# Audit Test 12: SQLite Persistence Across Application Restarts
# ============================================================================

def test_audit_12_sqlite_persistence_across_app_restarts(tmp_path):
    """
    Audit 12: Verify SQLite data persistence across application restarts
    using a persistent SQLite file database.
    """
    db_file = tmp_path / "drp_audit_restart.db"
    db_url = f"sqlite:///{db_file}"

    # --- Run 1: First Application Lifecycle ---
    engine1 = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine1)
    Session1 = sessionmaker(bind=engine1)
    session1 = Session1()

    c = Company(name="Persistent Corp", domain="https://persistent-corp.com")
    session1.add(c)
    session1.commit()
    c_id = c.id

    a = ProtectedAsset(company_id=c_id, asset_type="domain", value="https://persistent-corp.com", criticality="HIGH")
    session1.add(a)
    session1.commit()
    a_id = a.id

    cand = Candidate(company_id=c_id, asset_type="domain", value="https://persistent-fake.com", status="pending")
    session1.add(cand)
    session1.commit()
    cand_id = cand.id

    rf = RiskFinding(company_id=c_id, asset_id=a_id, candidate_id=cand_id, title="Stored Finding", severity="high", risk_score=80.0)
    session1.add(rf)
    session1.commit()
    rf_id = rf.id

    session1.close()
    engine1.dispose()

    # --- Run 2: Second Application Lifecycle (Simulated Restart) ---
    engine2 = create_engine(db_url, connect_args={"check_same_thread": False})
    Session2 = sessionmaker(bind=engine2)
    session2 = Session2()

    # Verify all records survived restart
    loaded_c = session2.query(Company).filter(Company.id == c_id).first()
    assert loaded_c is not None
    assert loaded_c.name == "Persistent Corp"
    assert loaded_c.domain == "https://persistent-corp.com"

    loaded_a = session2.query(ProtectedAsset).filter(ProtectedAsset.id == a_id).first()
    assert loaded_a is not None
    assert loaded_a.value == "https://persistent-corp.com"

    loaded_cand = session2.query(Candidate).filter(Candidate.id == cand_id).first()
    assert loaded_cand is not None
    assert loaded_cand.value == "https://persistent-fake.com"

    loaded_rf = session2.query(RiskFinding).filter(RiskFinding.id == rf_id).first()
    assert loaded_rf is not None
    assert loaded_rf.title == "Stored Finding"
    assert loaded_rf.risk_score == 80.0
    assert loaded_rf.company_id == c_id

    session2.close()
    engine2.dispose()


# ============================================================================
# Audit Test 13: CORS and Frontend Integration
# ============================================================================

def test_audit_13_cors_and_frontend_integration(client):
    """
    Audit 13: CORS headers for local frontend development and exposed headers.
    """
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }
    opt_res = client.options("/api/v1/companies", headers=headers)
    assert opt_res.status_code == 200
    assert opt_res.headers.get("access-control-allow-origin") == "http://localhost:5173"

    get_res = client.get("/api/v1/findings", headers={"Origin": "http://localhost:3000"})
    assert get_res.status_code == 200
    assert get_res.headers.get("access-control-allow-origin") == "http://localhost:3000"
    exposed = get_res.headers.get("access-control-expose-headers", "")
    assert "x-total-count" in exposed.lower()


# ============================================================================
# Audit Test 14: Missing AI or Monitoring Modules Handled Safely
# ============================================================================

def test_audit_14_missing_ai_or_monitoring_modules_safe_fallback(client, db_session):
    """
    Audit 14: When external AI/monitoring modules are missing/unset,
    the backend does not crash and applies safe deterministic fallback.
    """
    comp = Company(name="Fallback Corp", domain="https://fallback-corp.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    # Calling analyze without external services or credentials
    payload = {
        "company_id": comp.id,
        "candidate_name": "fallback-target",
        "domain": "https://fallback-suspicious-target.com",
        "source": "SCANNER",
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["company_id"] == comp.id
    assert data["finding_id"] is not None
    assert 0.0 <= data["estimated_risk_score"] <= 100.0


# ============================================================================
# Audit Test 15: Duplicate / Repeated Analysis Requests
# ============================================================================

def test_audit_15_duplicate_analysis_requests_deduplicated(client, db_session):
    """
    Audit 15: Repeated analysis requests for the same target with deduplicate=True
    update the existing finding rather than creating duplicates.
    """
    comp = Company(name="Dedup Audit Corp")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    payload = {
        "company_id": comp.id,
        "domain": "https://dedup-test-target.com",
        "candidate_type": "DOMAIN",
        "deduplicate": True,
    }

    # Request 1
    res1 = client.post("/api/v1/analyze", json=payload)
    assert res1.status_code == 200
    f_id1 = res1.json()["finding_id"]
    assert res1.json()["is_duplicate_updated"] is False

    # Request 2 (identical target)
    res2 = client.post("/api/v1/analyze", json=payload)
    assert res2.status_code == 200
    f_id2 = res2.json()["finding_id"]
    assert res2.json()["is_duplicate_updated"] is True

    # Same finding was updated, no second finding created
    assert f_id1 == f_id2
    total_findings = db_session.query(RiskFinding).filter(RiskFinding.company_id == comp.id).count()
    assert total_findings == 1
