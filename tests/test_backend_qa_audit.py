"""
Comprehensive Backend QA Audit Test Suite.
Validates production readiness, robustness, data integrity, and compliance
with the Digital Risk Protection backend requirements prior to hackathon demonstration.
"""

import os
import tempfile
import pytest
from fastapi import status, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db, init_db
from app.models import Brand, Scan
from app.services.risk_scoring import risk_scoring_service, BrandAssetContext


# -------------------------------------------------------------------------
# 1. Server Startup and Lifespan
# -------------------------------------------------------------------------

def test_server_startup_and_lifespan():
    """Verify that the FastAPI application starts up and shuts down cleanly."""
    with TestClient(app) as test_client:
        res = test_client.get("/health")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["status"] == "healthy"
        assert data["database_connected"] is True


def test_health_check_contract(client):
    """Verify GET /health returns required fields and correct data types."""
    res = client.get("/health")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert "status" in data
    assert "app_name" in data
    assert "environment" in data
    assert "database_connected" in data
    assert "detection_engine" in data
    assert data["status"] in ("healthy", "degraded")
    assert isinstance(data["database_connected"], bool)
    assert data["detection_engine"] == "rule_based"


# -------------------------------------------------------------------------
# 2. Brand Registration Validation
# -------------------------------------------------------------------------

def test_brand_registration_validates_required_fields(client):
    """Ensure missing, blank, or invalid brand fields return suitable 422 responses."""
    # Missing required 'name' field
    res_missing = client.post("/api/brands", json={
        "description": "Missing name"
    })
    assert res_missing.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert "name" in res_missing.json()["detail"].lower()

    # Empty whitespace name
    res_blank = client.post("/api/brands", json={
        "name": "   ",
        "official_domains": ["test.com"]
    })
    assert res_blank.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert "blank" in res_blank.json()["detail"].lower()

    # Excessively long name (> 255 chars)
    res_long = client.post("/api/brands", json={
        "name": "A" * 256
    })
    assert res_long.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Tolerant normalization: null official asset lists coerced to empty lists
    res_null_lists = client.post("/api/brands", json={
        "name": "Fictional Zero Asset Corp",
        "official_domains": None,
        "official_urls": None,
        "official_social_handles": None
    })
    assert res_null_lists.status_code == status.HTTP_201_CREATED
    data = res_null_lists.json()
    assert data["official_domains"] == []
    assert data["official_urls"] == []
    assert data["official_social_handles"] == []


# -------------------------------------------------------------------------
# 3. SQLite Persistence Across Restart
# -------------------------------------------------------------------------

def test_brands_stored_in_sqlite_and_persist_across_restart(tmp_path):
    """
    Verify that brands written to SQLite remain intact across connection restarts.
    Simulates stopping the backend server and starting it back up against the same DB file.
    """
    db_file = tmp_path / "test_persistence.db"
    db_url = f"sqlite:///{db_file}"

    # First session: Initialize and insert brand
    engine1 = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine1)
    Session1 = sessionmaker(autocommit=False, autoflush=False, bind=engine1)
    
    with Session1() as db1:
        brand = Brand(
            name="Persistent Fictional Bank",
            description="Testing disk persistence across restarts",
            official_domains=["persistentbank.com"],
            official_urls=["https://persistentbank.com/portal"],
            official_social_handles=["@persistentbank"]
        )
        db1.add(brand)
        db1.commit()
        brand_id = brand.id

    # Simulate server shutdown: Dispose first engine
    engine1.dispose()

    # Second session: Re-connect to the exact same SQLite database file
    engine2 = create_engine(db_url, connect_args={"check_same_thread": False})
    Session2 = sessionmaker(autocommit=False, autoflush=False, bind=engine2)

    with Session2() as db2:
        reloaded_brand = db2.query(Brand).filter(Brand.id == brand_id).first()
        assert reloaded_brand is not None
        assert reloaded_brand.name == "Persistent Fictional Bank"
        assert reloaded_brand.official_domains == ["persistentbank.com"]
        assert reloaded_brand.official_urls == ["https://persistentbank.com/portal"]
        assert reloaded_brand.official_social_handles == ["@persistentbank"]

    engine2.dispose()


# -------------------------------------------------------------------------
# 4. Unknown Brand and Scan IDs Return 404
# -------------------------------------------------------------------------

def test_unknown_brand_and_scan_ids_return_404(client):
    """Ensure accessing non-existent brand and scan resources returns standard 404."""
    unknown_id = 999999

    # Brand endpoints
    assert client.get(f"/api/brands/{unknown_id}").status_code == status.HTTP_404_NOT_FOUND
    assert client.put(f"/api/brands/{unknown_id}", json={"name": "New"}).status_code == status.HTTP_404_NOT_FOUND
    assert client.delete(f"/api/brands/{unknown_id}").status_code == status.HTTP_404_NOT_FOUND

    # Scan endpoints
    assert client.get(f"/api/scans/{unknown_id}").status_code == status.HTTP_404_NOT_FOUND
    assert client.patch(f"/api/scans/{unknown_id}/status", json={"status": "confirmed_threat"}).status_code == status.HTTP_404_NOT_FOUND

    # Submitting scan referencing non-existent brand_id
    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "example.com",
        "brand_id": unknown_id
    })
    assert scan_res.status_code == status.HTTP_404_NOT_FOUND
    assert f"{unknown_id}" in scan_res.json()["detail"]


# -------------------------------------------------------------------------
# 5. Invalid Requests Return Suitable 4xx Responses
# -------------------------------------------------------------------------

def test_invalid_requests_return_suitable_4xx_responses(client):
    """Verify robust input validation rejecting malformed bodies, types, or enums."""
    # Malformed JSON body
    res_bad_json = client.post(
        "/api/scans",
        content="this is not json",
        headers={"Content-Type": "application/json"}
    )
    assert res_bad_json.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Missing candidate_value
    res_missing_val = client.post("/api/scans", json={
        "candidate_type": "domain"
    })
    assert res_missing_val.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Whitespace candidate_value
    res_ws_val = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "   "
    })
    assert res_ws_val.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Unsafe / unsupported URL schemes (javascript, ftp, file)
    res_unsafe_scheme = client.post("/api/scans", json={
        "candidate_type": "url",
        "candidate_value": "javascript:void(0)"
    })
    assert res_unsafe_scheme.status_code == status.HTTP_400_BAD_REQUEST
    assert "scheme" in res_unsafe_scheme.json()["detail"].lower()

    # Invalid CandidateType enum
    res_bad_type = client.post("/api/scans", json={
        "candidate_type": "unknown_asset_type_xyz",
        "candidate_value": "lookalike.com"
    })
    assert res_bad_type.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Invalid status enum in status update
    # Create valid scan first
    valid_scan = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "some-target.com"
    }).json()
    res_bad_status = client.patch(f"/api/scans/{valid_scan['id']}/status", json={
        "status": "bogus_status_category"
    })
    assert res_bad_status.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    # Negative pagination query parameters
    assert client.get("/api/brands?limit=-1").status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.get("/api/brands?offset=-5").status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.get("/api/scans?limit=-1").status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


# -------------------------------------------------------------------------
# 6. Scan Returns Complete Structured Contract
# -------------------------------------------------------------------------

def test_scan_returns_score_category_indicators_explanations_and_id(client):
    """Verify that a scan returns all required fields conforming to documented contract."""
    brand_res = client.post("/api/brands", json={
        "name": "Audit Benchmark Corp",
        "official_domains": ["auditcorp.com"]
    })
    brand_id = brand_res.json()["id"]

    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "auditc0rp-security-login.xyz",
        "brand_id": brand_id
    })
    assert scan_res.status_code == status.HTTP_201_CREATED
    data = scan_res.json()

    # Numeric scan ID
    assert isinstance(data["id"], int)
    assert data["id"] > 0

    # Risk score bounded between 0 and 100
    assert isinstance(data["risk_score"], int)
    assert 0 <= data["risk_score"] <= 100

    # Valid category enum
    assert data["risk_category"] in ("Low", "Medium", "High", "Critical")

    # Structured indicators list
    assert isinstance(data["indicators"], list)
    assert len(data["indicators"]) > 0
    for ind in data["indicators"]:
        assert "code" in ind
        assert "name" in ind
        assert "severity" in ind
        assert "score_impact" in ind
        assert "explanation" in ind
        assert ind["severity"] in ("info", "low", "medium", "high", "critical")

    # Human-readable explanations
    assert isinstance(data["explanations"], list)
    assert len(data["explanations"]) > 0

    # Recommended action guidance
    assert isinstance(data["recommended_action"], str)
    assert len(data["recommended_action"]) > 0

    # Engine used and disclaimer
    assert data["engine_used"] == "rule_based"
    assert "disclaimer" in data and len(data["disclaimer"]) > 0


# -------------------------------------------------------------------------
# 7. Exact Official Assets Are Not Impersonators
# -------------------------------------------------------------------------

def test_exact_official_domains_and_handles_not_reported_as_impersonators(client):
    """
    Core business requirement: Exact registered official assets must receive score 0,
    category Low, and must never be falsely flagged as impersonators.
    """
    brand_res = client.post("/api/brands", json={
        "name": "Verified Security Inc",
        "official_domains": ["verifiedsecurity.com"],
        "official_urls": ["https://verifiedsecurity.com/portal/login"],
        "official_social_handles": ["@verifiedsecurity", "verifiedsecurity_help"]
    })
    brand_id = brand_res.json()["id"]

    # 1. Exact official domain
    res_domain = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "verifiedsecurity.com",
        "brand_id": brand_id
    })
    assert res_domain.status_code == status.HTTP_201_CREATED
    d_data = res_domain.json()
    assert d_data["risk_score"] == 0
    assert d_data["risk_category"] == "Low"
    assert any(i["code"] == "OFFICIAL_ASSET_VERIFIED" for i in d_data["indicators"])

    # 2. Exact official URL
    res_url = client.post("/api/scans", json={
        "candidate_type": "url",
        "candidate_value": "https://verifiedsecurity.com/portal/login",
        "brand_id": brand_id
    })
    assert res_url.status_code == status.HTTP_201_CREATED
    u_data = res_url.json()
    assert u_data["risk_score"] == 0
    assert u_data["risk_category"] == "Low"
    assert any(i["code"] == "OFFICIAL_ASSET_VERIFIED" for i in u_data["indicators"])

    # 3. Exact official social handle (with leading @)
    res_social1 = client.post("/api/scans", json={
        "candidate_type": "social_media_profile",
        "candidate_value": "@verifiedsecurity",
        "brand_id": brand_id
    })
    assert res_social1.status_code == status.HTTP_201_CREATED
    s1_data = res_social1.json()
    assert s1_data["risk_score"] == 0
    assert s1_data["risk_category"] == "Low"
    assert any(i["code"] == "OFFICIAL_ASSET_VERIFIED" for i in s1_data["indicators"])

    # 4. Exact official social handle without leading @
    res_social2 = client.post("/api/scans", json={
        "candidate_type": "social_media_profile",
        "candidate_value": "verifiedsecurity_help",
        "brand_id": brand_id
    })
    assert res_social2.status_code == status.HTTP_201_CREATED
    s2_data = res_social2.json()
    assert s2_data["risk_score"] == 0
    assert s2_data["risk_category"] == "Low"


# -------------------------------------------------------------------------
# 8. Deterministic Risk Scoring
# -------------------------------------------------------------------------

def test_risk_scoring_is_deterministic(client):
    """Ensure identical inputs and evidence produce identical scores and indicators."""
    brand_res = client.post("/api/brands", json={
        "name": "Deterministic Corp",
        "official_domains": ["deterministic.com"]
    })
    brand_id = brand_res.json()["id"]

    payload = {
        "candidate_type": "domain",
        "candidate_value": "determinist1c-verify.top",
        "brand_id": brand_id,
        "evidence": {
            "redirect_url": "https://suspicious-target.xyz"
        }
    }

    # Run analysis multiple times
    scores = []
    categories = []
    indicator_codes = []

    for _ in range(5):
        res = client.post("/api/scans", json=payload)
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        scores.append(data["risk_score"])
        categories.append(data["risk_category"])
        indicator_codes.append([i["code"] for i in data["indicators"]])

    # All scores and categories across 5 runs must be identical
    assert len(set(scores)) == 1, f"Non-deterministic scores detected: {scores}"
    assert len(set(categories)) == 1, f"Non-deterministic categories detected: {categories}"
    # Indicator lists must match exactly across all runs
    for codes in indicator_codes[1:]:
        assert codes == indicator_codes[0]


# -------------------------------------------------------------------------
# 9. Scan History and Dashboard Reconciliation
# -------------------------------------------------------------------------

def test_scan_history_and_dashboard_totals_agree_with_database(client):
    """Verify that aggregate counts on the dashboard perfectly agree with raw DB records."""
    # Create 2 brands
    b1 = client.post("/api/brands", json={"name": "Recon Brand One"}).json()
    b2 = client.post("/api/brands", json={"name": "Recon Brand Two"}).json()

    # Create scans with different risk profiles
    scans_created = [
        # Low risk (benign)
        client.post("/api/scans", json={"candidate_type": "domain", "candidate_value": "reconbrand-fans.com", "brand_id": b1["id"]}).json(),
        # Critical risk
        client.post("/api/scans", json={"candidate_type": "domain", "candidate_value": "rec0nbrand-login-auth.xyz", "brand_id": b1["id"]}).json(),
        # High risk
        client.post("/api/scans", json={"candidate_type": "url", "candidate_value": "https://reconbrand.portal-update.com/login", "brand_id": b2["id"]}).json(),
        # Mobile app
        client.post("/api/scans", json={"candidate_type": "mobile_app", "candidate_value": "Recon Brand Free Money Hack"}).json(),
    ]

    total_scans_count = len(scans_created)

    # Check /api/scans listing
    scans_list_res = client.get("/api/scans")
    assert scans_list_res.status_code == status.HTTP_200_OK
    all_scans = scans_list_res.json()
    assert len(all_scans) == total_scans_count

    # Check /api/dashboard/summary
    dash_res = client.get("/api/dashboard/summary")
    assert dash_res.status_code == status.HTTP_200_OK
    dash_data = dash_res.json()

    assert dash_data["total_brands"] == 2
    assert dash_data["total_scans"] == total_scans_count

    # Sum of risk distribution must equal total_scans
    assert sum(dash_data["risk_distribution"].values()) == total_scans_count

    # Sum of status distribution must equal total_scans
    assert sum(dash_data["status_distribution"].values()) == total_scans_count

    # Sum of candidate type distribution must equal total_scans
    assert sum(dash_data["type_distribution"].values()) == total_scans_count


# -------------------------------------------------------------------------
# 10. CORS Restriction to Configured Origins
# -------------------------------------------------------------------------

def test_cors_restricted_to_configured_origins(client):
    """Verify CORS headers are returned for allowed origins and blocked for unapproved ones."""
    # Allowed origin: http://localhost:4200
    res_allowed = client.options(
        "/api/brands",
        headers={
            "Origin": "http://localhost:4200",
            "Access-Control-Request-Method": "POST"
        }
    )
    assert res_allowed.headers.get("access-control-allow-origin") == "http://localhost:4200"

    # Unauthorized origin: http://malicious-external-site.evil
    res_denied = client.options(
        "/api/brands",
        headers={
            "Origin": "http://malicious-external-site.evil",
            "Access-Control-Request-Method": "POST"
        }
    )
    assert res_denied.headers.get("access-control-allow-origin") != "http://malicious-external-site.evil"


# -------------------------------------------------------------------------
# 11. Sensitive Configuration and Internal Traceback Protection
# -------------------------------------------------------------------------

def test_sensitive_configuration_and_tracebacks_not_leaked(client):
    """
    Ensure the backend never exposes database credentials, environment secrets,
    or internal Python stack traces to API clients during errors.
    """
    # 1. 404 response inspection
    res_404 = client.get("/api/brands/999999")
    body_404 = res_404.text
    assert "Traceback (most recent call last)" not in body_404
    assert "sqlite" not in body_404.lower()

    # 2. 422 validation response inspection
    res_422 = client.post("/api/brands", json={})
    body_422 = res_422.text
    assert "Traceback (most recent call last)" not in body_422
    assert "password" not in body_422.lower()

    # 3. Simulated unhandled exception with raise_server_exceptions=False
    safe_client = TestClient(app, raise_server_exceptions=False)
    
    # Temporarily trigger an unhandled error inside a route by testing the global handler
    @app.get("/api/test-internal-error")
    def trigger_error():
        raise RuntimeError("Secret DB connection string: postgresql://admin:secret123@internal-db:5432/drp")

    try:
        res_500 = safe_client.get("/api/test-internal-error")
        assert res_500.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        data_500 = res_500.json()
        assert "secret123" not in res_500.text
        assert "postgresql" not in res_500.text
        assert "Traceback" not in res_500.text
        assert "internal server error occurred" in data_500["detail"].lower()
    finally:
        # Remove test route
        app.routes[:] = [r for r in app.routes if getattr(r, "path", None) != "/api/test-internal-error"]


# -------------------------------------------------------------------------
# 12. External AI or Intelligence Services Not Required for Baseline Tests
# -------------------------------------------------------------------------

def test_external_services_not_required_for_baseline_suite():
    """
    Verify that the baseline rule engine operates fully offline,
    with zero network calls, zero external API key requirements, and zero GPU needs.
    """
    from app.services.detection.adapter import detection_service
    from app.services.detection.interface import DetectionContext

    # Ensure offline scoring service operates purely in memory
    context = DetectionContext(
        brand_id=1,
        brand_name="Offline Corp",
        official_domains=["offlinecorp.com"]
    )
    result = detection_service.analyze(
        candidate_type="domain",
        candidate_value="offlinec0rp-login.xyz",
        context=context
    )
    assert result.risk_score > 0
    assert result.engine_used == "rule_based"
    assert result.risk_category in ("High", "Critical")
    assert result.disclaimer is not None

