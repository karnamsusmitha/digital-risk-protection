import pytest
from app.models import Company, ProtectedAsset, Candidate, RiskFinding


def test_persistence_of_all_entities(db_session):
    # 1. Company
    comp = Company(name="Cyber Defense Corp", description="SOC 2 compliant monitored enterprise")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    assert comp.id is not None
    assert comp.created_at is not None
    assert comp.name == "Cyber Defense Corp"

    # 2. ProtectedAsset
    asset = ProtectedAsset(
        company_id=comp.id,
        asset_type="social_profile",
        value="@cyberdef_hq",
        platform="twitter",
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    assert asset.id is not None
    assert asset.company_id == comp.id
    assert asset.created_at is not None

    # 3. Candidate
    meta = {"followers": 12, "account_created": "2026-10-01", "ip": "198.51.100.22"}
    candidate = Candidate(
        company_id=comp.id,
        asset_id=asset.id,
        asset_type="social_profile",
        value="@cyberdef_hq_fake",
        platform="twitter",
        observed_metadata=meta,
    )
    db_session.add(candidate)
    db_session.commit()
    db_session.refresh(candidate)

    assert candidate.id is not None
    assert candidate.observed_metadata == meta
    assert candidate.created_at is not None

    # 4. RiskFinding
    evidence_json = {
        "detection_vector": "impersonation_scanner",
        "impersonated_handle": "@cyberdef_hq",
        "suspicious_indicators": ["lookalike_bio", "fresh_account"],
    }
    finding = RiskFinding(
        company_id=comp.id,
        candidate_id=candidate.id,
        asset_id=asset.id,
        risk_score=78.5,
        severity="high",
        status="pending",
        reasons=["Direct executive impersonation with scam links in bio"],
        evidence=evidence_json,
    )
    db_session.add(finding)
    db_session.commit()
    db_session.refresh(finding)

    assert finding.id is not None
    assert finding.risk_score == 78.5
    assert finding.severity == "high"
    assert finding.status == "pending"
    assert finding.evidence == evidence_json
    assert finding.created_at is not None


def test_querying_with_indexes_and_filters(db_session):
    comp = Company(name="Index Testing Corp")
    db_session.add(comp)
    db_session.commit()

    # Add several findings with varying severity and status
    f1 = RiskFinding(company_id=comp.id, risk_score=95.0, severity="critical", status="pending")
    f2 = RiskFinding(company_id=comp.id, risk_score=80.0, severity="high", status="pending")
    f3 = RiskFinding(company_id=comp.id, risk_score=20.0, severity="low", status="completed")
    db_session.add_all([f1, f2, f3])
    db_session.commit()

    # Query filtered by severity
    critical_findings = db_session.query(RiskFinding).filter(
        RiskFinding.company_id == comp.id,
        RiskFinding.severity == "critical",
    ).all()
    assert len(critical_findings) == 1
    assert critical_findings[0].risk_score == 95.0

    # Query filtered by status
    pending_findings = db_session.query(RiskFinding).filter(
        RiskFinding.company_id == comp.id,
        RiskFinding.status == "pending",
    ).all()
    assert len(pending_findings) == 2


# ============================================================================
# Safe Missing Records Handling (API & Session)
# ============================================================================

def test_api_missing_records_handled_safely(client):
    # 1. Nonexistent company lookup -> 404
    res = client.get("/api/v1/companies/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

    # 2. Nonexistent asset lookup -> 404
    res = client.get("/api/v1/assets/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

    # 3. Nonexistent candidate lookup -> 404
    res = client.get("/api/v1/candidates/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

    # 4. Nonexistent finding lookup -> 404
    res = client.get("/api/v1/findings/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_api_creating_child_for_nonexistent_parent_returns_404(client):
    # Attempt to create asset for nonexistent company
    asset_payload = {
        "company_id": 888888,
        "asset_type": "domain",
        "value": "nonexistent.com",
    }
    res = client.post("/api/v1/assets/", json=asset_payload)
    assert res.status_code == 404
    assert "does not exist" in res.json()["detail"]

    # Attempt to create finding for nonexistent company
    finding_payload = {
        "company_id": 888888,
        "risk_score": 75.0,
        "severity": "high",
        "status": "pending",
    }
    res = client.post("/api/v1/findings/", json=finding_payload)
    assert res.status_code == 404
    assert "does not exist" in res.json()["detail"]


def test_api_full_crud_lifecycle(client):
    # 1. Create company
    c_res = client.post("/api/v1/companies/", json={"name": "Lifecycle Corp", "description": "Testing full API"})
    assert c_res.status_code == 201
    company_id = c_res.json()["id"]

    # 2. Create asset
    a_res = client.post("/api/v1/assets/", json={
        "company_id": company_id,
        "asset_type": "mobile_app",
        "value": "com.lifecycle.app",
        "platform": "android",
    })
    assert a_res.status_code == 201
    asset_id = a_res.json()["id"]

    # 3. Create candidate
    cand_res = client.post("/api/v1/candidates/", json={
        "company_id": company_id,
        "asset_id": asset_id,
        "asset_type": "mobile_app",
        "value": "https://malicious-store.com/com.lifecycle.app.apk",
        "platform": "android",
        "observed_metadata": {"hashes": ["abc123def456"]},
    })
    assert cand_res.status_code == 201
    candidate_id = cand_res.json()["id"]

    # 4. Create finding
    f_res = client.post("/api/v1/findings/", json={
        "company_id": company_id,
        "candidate_id": candidate_id,
        "asset_id": asset_id,
        "risk_score": 88.0,
        "severity": "critical",
        "status": "pending",
        "reasons": ["Repackaged Trojanized APK detected in 3rd party app store"],
        "evidence": {"apk_hash": "abc123def456", "url": "https://malicious-store.com/com.lifecycle.app.apk"},
    })
    assert f_res.status_code == 201
    finding_id = f_res.json()["id"]

    # 5. Retrieve finding
    get_f = client.get(f"/api/v1/findings/{finding_id}")
    assert get_f.status_code == 200
    assert get_f.json()["risk_score"] == 88.0
    assert get_f.json()["severity"] == "critical"
    assert get_f.json()["status"] == "pending"

    # 6. Update finding
    up_f = client.put(f"/api/v1/findings/{finding_id}", json={
        "status": "completed",
    })
    assert up_f.status_code == 200
    assert up_f.json()["status"] == "completed"

    # 7. Delete finding
    del_f = client.delete(f"/api/v1/findings/{finding_id}")
    assert del_f.status_code == 204
