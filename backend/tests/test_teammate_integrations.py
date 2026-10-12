import pytest
from unittest.mock import patch, MagicMock
import httpx
from app.models import Company, RiskFinding
from app.schemas import AIEvidence, MonitoringEvidence
from app.services.integrations import (
    call_external_ai_service,
    call_external_monitoring_service,
    mask_sensitive_headers,
)


def test_ai_evidence_schema_validation():
    # Valid evidence
    valid = AIEvidence(
        name_similarity=0.92,
        logo_similarity=0.88,
        model_name="vit-brand-v2",
        model_confidence=0.95,
        analysis_timestamp="2026-10-12T12:00:00Z",
        details={"embedding_dim": 512},
    )
    assert valid.name_similarity == 0.92
    assert valid.logo_similarity == 0.88
    assert valid.model_confidence == 0.95

    # Invalid range (> 1.0) -> validation error
    with pytest.raises(ValueError):
        AIEvidence(name_similarity=1.5)

    with pytest.raises(ValueError):
        AIEvidence(logo_similarity=-0.2)


def test_monitoring_evidence_schema_validation():
    valid = MonitoringEvidence(
        candidate_url="https://phishing-portal.com/login",
        asset_type="domain",
        platform="web",
        observed_metadata={"dns": "active", "mx": "mail.phishing-portal.com"},
        source_identifier="crawler-agent-01",
        observation_timestamp="2026-10-12T12:00:00Z",
    )
    assert valid.candidate_url == "https://phishing-portal.com/login"
    assert valid.asset_type == "domain"

    # Invalid URL format raises ValueError
    with pytest.raises(ValueError):
        MonitoringEvidence(candidate_url="not_a_valid_url_scheme")


def test_mask_sensitive_headers_protects_secrets():
    raw_headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer super-secret-jwt-token-12345",
        "X-API-Key": "secret-api-key-abcdef",
        "User-Agent": "DRP-Scanner/1.0",
    }
    masked = mask_sensitive_headers(raw_headers)
    assert masked["Authorization"] == "***MASKED***"
    assert masked["X-API-Key"] == "***MASKED***"
    assert masked["Content-Type"] == "application/json"
    assert masked["User-Agent"] == "DRP-Scanner/1.0"
    assert "super-secret" not in str(masked)
    assert "abcdef" not in str(masked)


def test_analyze_with_full_ai_and_monitoring_evidence(client, db_session):
    # Setup company
    comp = Company(name="FinTech Global", domain="fintech-global.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    payload = {
        "company_id": comp.id,
        "ai_evidence": {
            "name_similarity": 0.85,
            "logo_similarity": 0.92,
            "model_name": "vit-logo-classifier",
            "model_confidence": 0.90,
            "analysis_timestamp": "2026-10-12T12:00:00Z",
            "details": {"feature_vector": [0.1, 0.2, 0.3]},
        },
        "monitoring_evidence": {
            "candidate_url": "https://fintech-global-auth-portal.com/login",
            "asset_type": "domain",
            "platform": "web",
            "observed_metadata": {"active_dns": True, "active_mx": True, "domain_age_days": 3},
            "source_identifier": "teammate-scanner-agent-4",
            "observation_timestamp": "2026-10-12T12:00:00Z",
        },
        "candidate_type": "PHISHING",
        "threat_indicators": ["active_mx", "resolving_ip"],
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["company_id"] == comp.id
    assert data["ai_evidence"] is not None
    assert data["ai_evidence"]["name_similarity"] == 0.85
    assert data["ai_evidence"]["logo_similarity"] == 0.92
    assert data["monitoring_evidence"] is not None
    assert data["monitoring_evidence"]["candidate_url"] == "https://fintech-global-auth-portal.com/login"

    # High severity because AI logo similarity + active DNS + phishing keywords
    assert data["recommended_severity"] in ("HIGH", "CRITICAL")
    assert data["estimated_risk_score"] >= 60.0
    assert data["should_convert_to_finding"] is True
    assert data["is_fallback"] is False
    assert data["execution_mode"] == "live_integrated"

    # Check evidence stored in database
    finding_id = data["finding_id"]
    db_finding = db_session.query(RiskFinding).filter(RiskFinding.id == finding_id).first()
    assert db_finding is not None
    assert db_finding.evidence["ai_evidence"]["model_name"] == "vit-logo-classifier"
    assert db_finding.evidence["monitoring_evidence"]["source_identifier"] == "teammate-scanner-agent-4"


def test_unavailable_evidence_treated_as_null_without_crashing(client, db_session):
    comp = Company(name="HealthCare Group", domain="healthcare-grp.org")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    # Empty evidence payloads where AI or monitoring is unavailable
    payload = {
        "company_id": comp.id,
        "ai_evidence": None,
        "monitoring_evidence": None,
        "domain": "healthcare-grp-update.org",
        "source": "EXTERNAL_REPORT",
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["ai_evidence"] is None
    assert data["monitoring_evidence"] is None
    assert data["is_fallback"] is False
    assert data["recommended_severity"] == "LOW"
    assert data["estimated_risk_score"] < 35.0


def test_deduplication_updates_existing_finding_instead_of_duplicating(client, db_session):
    comp = Company(name="Dedup Enterprise", domain="dedup-corp.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    initial_count = db_session.query(RiskFinding).filter(RiskFinding.company_id == comp.id).count()

    payload = {
        "company_id": comp.id,
        "candidate_url": "https://dedup-corp-phish.com/login",
        "candidate_type": "PHISHING",
        "source": "SCANNER_A",
        "deduplicate": True,
        "threat_indicators": ["active"],
    }

    # 1. First analysis creates finding #1
    res1 = client.post("/api/v1/analyze", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()
    finding_id1 = data1["finding_id"]
    assert data1["is_duplicate_updated"] is False

    findings_after_first = db_session.query(RiskFinding).filter(RiskFinding.company_id == comp.id).count()
    assert findings_after_first == initial_count + 1

    # 2. Second analysis for the same target with updated evidence
    payload_update = {
        "company_id": comp.id,
        "candidate_url": "https://dedup-corp-phish.com/login",
        "candidate_type": "PHISHING",
        "source": "SCANNER_B",
        "deduplicate": True,
        "threat_indicators": ["active", "exposed_secret"],
        "name_similarity": 0.90,
    }
    res2 = client.post("/api/v1/analyze", json=payload_update)
    assert res2.status_code == 200
    data2 = res2.json()

    # Rule 5: Avoid duplicate findings for repeated analyses
    assert data2["finding_id"] == finding_id1
    assert data2["is_duplicate_updated"] is True

    # Total row count should NOT increase
    findings_after_second = db_session.query(RiskFinding).filter(RiskFinding.company_id == comp.id).count()
    assert findings_after_second == findings_after_first

    # Updated finding has new score
    db_finding = db_session.query(RiskFinding).filter(RiskFinding.id == finding_id1).first()
    assert db_finding.risk_score == data2["estimated_risk_score"]


def test_external_ai_service_timeout_handling_with_deterministic_fallback():
    # Simulate a timeout when calling teammate AI module over HTTP
    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("Connection timed out")):
        ev, is_fallback, reason = call_external_ai_service(
            target_url="https://phish.com",
            service_url="http://fake-ai-service:9000/detect",
            timeout=1.0,
        )
        assert is_fallback is True
        assert ev is not None
        assert ev.model_name == "deterministic_fallback_engine"
        assert reason is not None and "timed out" in reason.lower()


def test_external_monitoring_service_error_handling_with_fallback():
    # Simulate a connection error when calling teammate monitoring module
    with patch("httpx.Client.post", side_effect=httpx.ConnectError("Connection refused")):
        ev, is_fallback, reason = call_external_monitoring_service(
            candidate_url="https://scanner.com",
            service_url="http://fake-monitoring-service:9001/scan",
            timeout=1.0,
        )
        assert is_fallback is True
        assert ev is not None
        assert ev.source_identifier == "deterministic_fallback_engine"
        assert reason is not None and "unavailable" in reason.lower()


def test_api_does_not_leak_keys_in_response(client, db_session):
    comp = Company(name="Vault Bank", domain="vaultbank.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    secret_key = "super-secret-teammate-token-9999"
    payload = {
        "company_id": comp.id,
        "domain": "vaultbank-secure.net",
        "evidence": {"internal_token": secret_key},
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    res_str = res.text

    # Verify no Authorization or secret headers leaked
    assert "Authorization" not in res.headers
    assert "X-API-Key" not in res.headers
