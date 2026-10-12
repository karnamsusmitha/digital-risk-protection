import pytest
from app.models import Company, ProtectedAsset, RiskFinding
from app.services.risk_scoring import (
    DEFAULT_SEVERITY_THRESHOLDS,
    WEIGHT_NAME_SIMILARITY_MAX,
    map_score_to_severity,
    evaluate_modular_risk,
    register_signal_evaluator,
    ScoringContext,
    SignalContribution,
)


def test_severity_thresholds_mapping():
    # Default thresholds: CRITICAL >= 80, HIGH >= 60, MEDIUM >= 35, LOW < 35
    assert map_score_to_severity(0.0) == "LOW"
    assert map_score_to_severity(34.9) == "LOW"
    assert map_score_to_severity(35.0) == "MEDIUM"
    assert map_score_to_severity(59.9) == "MEDIUM"
    assert map_score_to_severity(60.0) == "HIGH"
    assert map_score_to_severity(79.9) == "HIGH"
    assert map_score_to_severity(80.0) == "CRITICAL"
    assert map_score_to_severity(100.0) == "CRITICAL"

    # Custom thresholds
    custom = {"CRITICAL": 90.0, "HIGH": 70.0, "MEDIUM": 40.0, "LOW": 0.0}
    assert map_score_to_severity(75.0, thresholds=custom) == "HIGH"
    assert map_score_to_severity(85.0, thresholds=custom) == "HIGH"
    assert map_score_to_severity(90.0, thresholds=custom) == "CRITICAL"


def test_score_bounds_and_capping():
    # Context with overwhelming signals
    ctx = ScoringContext(
        company=None,
        candidate_name="Overwhelming Phish",
        candidate_type="PHISHING",
        target_value="https://mega-steal-login.com",
        domain="mega-steal-login.com",
        profile_url="https://twitter.com/fake",
        app_listing="com.fake.app",
        source="TEST",
        raw_data="aws_secret private_key password token",
        threat_indicators=["active", "active_mx", "resolving_ip", "exposed_secret"],
        name_similarity=1.0,
        logo_similarity=1.0,
        monitoring_metadata={"active_dns": True, "active_mx": True, "domain_age_days": 1},
        additional_evidence={},
        thresholds=DEFAULT_SEVERITY_THRESHOLDS,
    )
    result = evaluate_modular_risk(ctx)
    assert 0.0 <= result.overall_risk_score <= 100.0
    assert result.overall_risk_score == 100.0
    assert result.severity == "CRITICAL"
    assert result.should_convert_to_finding is True


def test_official_asset_exact_match_exclusion(client, db_session):
    # 1. Register company and official domain asset
    comp = Company(name="Acme Corp", domain="acme.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    asset = ProtectedAsset(
        company_id=comp.id,
        asset_type="domain",
        value="auth.acme.com",
        platform="web",
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    # 2. Analyze target that matches official asset
    payload = {
        "company_id": comp.id,
        "domain": "https://auth.acme.com/login?redirect=dashboard",
        "candidate_type": "PHISHING",
        "source": "MONITOR",
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Rule 8: Exclude exact matches to registered official assets and record exclusion reason
    assert data["is_official_asset_match"] is True
    assert data["estimated_risk_score"] == 0.0
    assert data["recommended_severity"] == "LOW"
    assert data["should_convert_to_finding"] is False
    assert data["official_exclusion_reason"] is not None
    assert "auth.acme.com" in data["official_exclusion_reason"]
    assert data["status"] == "resolved"


def test_name_similarity_alone_does_not_classify_as_fraudulent(client, db_session):
    comp = Company(name="Stripe Payments", domain="stripe.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    # Rule 9: Do not classify an entity as fraudulent solely because its name resembles a brand
    # Here, name_similarity is high (0.95), but no other malicious signals are present
    payload = {
        "company_id": comp.id,
        "candidate_name": "Stripe",
        "domain": "stripe-unrelated-blog.net",
        "candidate_type": "LOOKALIKE_NAME",
        "source": "AI_DETECTOR",
        "name_similarity": 0.95,
        "logo_similarity": None,
        "threat_indicators": [],
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Score should be low, never high/critical
    assert data["estimated_risk_score"] < DEFAULT_SEVERITY_THRESHOLDS["MEDIUM"]
    assert data["recommended_severity"] == "LOW"
    assert data["should_convert_to_finding"] is False

    # Check that explanation mentions the rule
    all_reasons = " ".join(data["reasons"])
    assert "alone is not classified as fraudulent" in all_reasons


def test_missing_evidence_does_not_crash_or_inflate_risk(client, db_session):
    comp = Company(name="Initech Software", domain="initech.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    # Rules 6 & 7: Handle missing evidence without crashing. Do not treat missing evidence as proof of malicious activity.
    payload = {
        "company_id": comp.id,
        "candidate_type": "UNKNOWN_SIGNAL",
        "source": "PASSIVE_PROBE",
        # Missing all optional signals:
        "name_similarity": None,
        "logo_similarity": None,
        "monitoring_metadata": None,
        "raw_data": None,
        "threat_indicators": None,
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["estimated_risk_score"] < DEFAULT_SEVERITY_THRESHOLDS["MEDIUM"]
    assert data["recommended_severity"] == "LOW"
    assert data["should_convert_to_finding"] is False

    # Explanation notes missing signals cleanly
    reasons_str = " ".join(data["reasons"])
    assert "Missing signal" in reasons_str


def test_database_persistence_of_risk_assessment(client, db_session):
    comp = Company(name="Cyber Vanguard", domain="vanguard-ops.io")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    payload = {
        "company_id": comp.id,
        "candidate_type": "CREDENTIAL_EXPOSURE",
        "source": "DARK_WEB_INDEX",
        "raw_data": "aws_secret_access_key and token found",
        "threat_indicators": ["active", "exposed_secret"],
        "name_similarity": 0.85,
        "logo_similarity": 0.90,
    }
    res = client.post("/api/v1/analyze", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Rule 4: Store score, severity, evidence and status in database
    finding_id = data["finding_id"]
    assert finding_id is not None

    finding_in_db = db_session.query(RiskFinding).filter(RiskFinding.id == finding_id).first()
    assert finding_in_db is not None
    assert finding_in_db.company_id == comp.id
    assert finding_in_db.risk_score == data["estimated_risk_score"]
    assert finding_in_db.severity == data["recommended_severity"].lower()
    assert finding_in_db.status == data["status"]
    assert finding_in_db.evidence is not None
    assert finding_in_db.reasons is not None
    assert len(finding_in_db.reasons) > 0


def test_extensibility_custom_signal_evaluator():
    # Rule 10: Allow AI and monitoring signals to be added without rewriting the scoring service
    def custom_dark_web_ransom_evaluator(ctx: ScoringContext):
        if ctx.additional_evidence.get("ransom_mention") is True:
            return SignalContribution(
                signal_name="ransom_mention",
                score=30.0,
                reason="Ransomware leak portal listed corporate domain (+30.0 pts).",
                evidence={"ransom_operator": ctx.additional_evidence.get("operator")},
                confidence=0.95,
            )
        return None

    register_signal_evaluator(custom_dark_web_ransom_evaluator)

    ctx = ScoringContext(
        company=None,
        candidate_name="Custom Test",
        candidate_type="EXTORTION",
        target_value="https://leak-site.onion/target",
        domain="leak-site.onion",
        profile_url=None,
        app_listing=None,
        source="DARKWEB",
        raw_data="ransomware victim listing",
        threat_indicators=[],
        name_similarity=None,
        logo_similarity=None,
        monitoring_metadata={},
        additional_evidence={"ransom_mention": True, "operator": "LockBit"},
        thresholds=DEFAULT_SEVERITY_THRESHOLDS,
    )
    result = evaluate_modular_risk(ctx)
    assert any("Ransomware leak portal" in r for r in result.reasons)
    assert result.evidence["input_signals"]["ransom_mention"]["evidence"]["ransom_operator"] == "LockBit"


def test_preliminary_assessment_notice_and_disclaimer(client, db_session):
    comp = Company(name="Disclose Corp", domain="disclose.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    res = client.post("/api/v1/analyze", json={"company_id": comp.id, "source": "SCANNER"})
    assert res.status_code == 200
    data = res.json()

    assert data["assessment_type"] == "preliminary_risk_assessment"
    assert "preliminary" in data["disclaimer"].lower()
    assert "No external" in data["disclaimer"]
