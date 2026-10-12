import pytest
from pydantic import ValidationError
from app.schemas import (
    CompanyCreate,
    ProtectedAssetCreate,
    CandidateCreate,
    RiskFindingCreate,
    validate_url_string,
)
from app.models import Company, ProtectedAsset, Candidate, RiskFinding


# ============================================================================
# URL Validation Tests
# ============================================================================

def test_validate_url_string_valid():
    valid_urls = [
        "https://example.com",
        "http://sub.domain.co.uk/path?q=1#frag",
        "https://company.brand.org/login",
        "http://192.168.1.1:8080/portal",
    ]
    for url in valid_urls:
        assert validate_url_string(url) == url


def test_validate_url_string_invalid():
    invalid_urls = [
        "ftp://example.com",
        "http://",
        "https://",
        "not-a-url",
        "javascript:alert(1)",
        "",
        "http:///missing-host",
    ]
    for url in invalid_urls:
        with pytest.raises(ValueError):
            validate_url_string(url)


# ============================================================================
# ProtectedAsset Validation Tests
# ============================================================================

@pytest.mark.parametrize("asset_type", ["brand_name", "domain", "social_profile", "mobile_app"])
def test_protected_asset_valid_asset_types(asset_type):
    asset = ProtectedAssetCreate(
        company_id=1,
        asset_type=asset_type,
        value="example-asset",
    )
    assert asset.asset_type == asset_type
    assert asset.name == "example-asset"


def test_protected_asset_case_insensitive_asset_type():
    asset = ProtectedAssetCreate(
        company_id=1,
        asset_type="DOMAIN",
        value="https://acme.org",
    )
    assert asset.asset_type == "domain"


def test_protected_asset_invalid_asset_type_raises():
    with pytest.raises(ValidationError) as exc:
        ProtectedAssetCreate(
            company_id=1,
            asset_type="cloud_server",
            value="10.0.0.1",
        )
    assert "Invalid asset_type" in str(exc.value)


def test_protected_asset_validates_url_in_value():
    # Valid URL in value
    valid_asset = ProtectedAssetCreate(
        company_id=1,
        asset_type="domain",
        value="https://monitored-site.com",
    )
    assert valid_asset.value == "https://monitored-site.com"

    # Malformed URL in value
    with pytest.raises(ValidationError):
        ProtectedAssetCreate(
            company_id=1,
            asset_type="domain",
            value="http://",
        )


def test_protected_asset_empty_value_raises():
    with pytest.raises(ValidationError):
        ProtectedAssetCreate(
            company_id=1,
            asset_type="domain",
            value="   ",
        )


# ============================================================================
# Candidate Validation Tests
# ============================================================================

def test_candidate_valid_creation():
    candidate = CandidateCreate(
        asset_type="domain",
        value="https://phishing-lookalike.com/login",
        platform="web",
        observed_metadata={"dns_resolves": True, "ip": "1.2.3.4"},
    )
    assert candidate.asset_type == "domain"
    assert candidate.value == "https://phishing-lookalike.com/login"
    assert candidate.observed_metadata is not None
    assert candidate.observed_metadata["dns_resolves"] is True


def test_candidate_invalid_url_raises():
    with pytest.raises(ValidationError):
        CandidateCreate(
            asset_type="domain",
            value="https://",
        )


def test_candidate_explicit_url_field_validation():
    # Valid explicit URL
    cand = CandidateCreate(
        asset_type="social_profile",
        value="@impersonator_handle",
        url="https://twitter.com/impersonator_handle",
    )
    assert cand.url == "https://twitter.com/impersonator_handle"

    # Invalid explicit URL
    with pytest.raises(ValidationError):
        CandidateCreate(
            asset_type="social_profile",
            value="@impersonator_handle",
            url="ftp://bad-url",
        )


def test_candidate_invalid_asset_type_raises():
    with pytest.raises(ValidationError) as exc:
        CandidateCreate(
            asset_type="unsupported_type",
            value="test",
        )
    assert "Invalid asset_type" in str(exc.value)


def test_candidate_observed_metadata_must_be_json_dict():
    # Non-dictionary observed_metadata raises
    with pytest.raises(ValidationError):
        CandidateCreate(
            asset_type="brand_name",
            value="brand-typo",
            observed_metadata="not a dict",
        )


# ============================================================================
# RiskFinding Validation Tests
# ============================================================================

@pytest.mark.parametrize("score", [0.0, 25.5, 50.0, 99.9, 100.0])
def test_risk_finding_valid_scores(score):
    finding = RiskFindingCreate(
        company_id=1,
        risk_score=score,
        severity="medium",
        status="pending",
    )
    assert finding.risk_score == score


@pytest.mark.parametrize("invalid_score", [-1.0, -0.1, 100.1, 150.0, 999.0])
def test_risk_finding_invalid_scores_raise(invalid_score):
    with pytest.raises(ValidationError):
        RiskFindingCreate(
            company_id=1,
            risk_score=invalid_score,
            severity="medium",
            status="pending",
        )


@pytest.mark.parametrize("sev", ["low", "medium", "high", "critical", "LOW", "High", "CRITICAL"])
def test_risk_finding_valid_severities(sev):
    finding = RiskFindingCreate(
        company_id=1,
        risk_score=50.0,
        severity=sev,
        status="pending",
    )
    assert finding.severity == sev.lower()


def test_risk_finding_invalid_severity_raises():
    with pytest.raises(ValidationError) as exc:
        RiskFindingCreate(
            company_id=1,
            risk_score=50.0,
            severity="extreme",
            status="pending",
        )
    assert "Invalid severity" in str(exc.value)


@pytest.mark.parametrize("status_val", ["pending", "completed", "failed", "PENDING", "Completed"])
def test_risk_finding_valid_statuses(status_val):
    finding = RiskFindingCreate(
        company_id=1,
        risk_score=50.0,
        severity="medium",
        status=status_val,
    )
    assert finding.status == status_val.lower()


def test_risk_finding_invalid_status_raises():
    with pytest.raises(ValidationError) as exc:
        RiskFindingCreate(
            company_id=1,
            risk_score=50.0,
            severity="medium",
            status="unknown_status",
        )
    assert "Invalid status" in str(exc.value)


def test_risk_finding_structured_evidence():
    evidence_payload = {
        "source": "threat_scanner",
        "url": "https://phishing-test.com",
        "indicators": ["mx_records", "lookalike"],
        "telemetry": {"detections": 4},
    }
    finding = RiskFindingCreate(
        company_id=1,
        risk_score=85.0,
        severity="critical",
        status="pending",
        reasons=["Lookalike domain registered with active mail exchange"],
        evidence=evidence_payload,
    )
    assert isinstance(finding.evidence, dict)
    assert finding.evidence["source"] == "threat_scanner"
    assert finding.evidence["url"] == "https://phishing-test.com"


def test_risk_finding_invalid_url_in_evidence_raises():
    with pytest.raises(ValidationError):
        RiskFindingCreate(
            company_id=1,
            risk_score=85.0,
            severity="high",
            status="pending",
            evidence={"url": "not-valid-url"},
        )


# ============================================================================
# Privacy / Data Minimization Tests
# ============================================================================

def test_data_minimization_blocks_sensitive_pii():
    with pytest.raises(ValidationError) as exc:
        CompanyCreate(
            name="123-45-6789",  # SSN pattern
        )
    assert "Data minimization violation" in str(exc.value)

    with pytest.raises(ValidationError) as exc:
        ProtectedAssetCreate(
            company_id=1,
            asset_type="brand_name",
            value="4111 1111 1111 1111",  # Credit card pattern
        )
    assert "Data minimization violation" in str(exc.value)


# ============================================================================
# ORM Model-Level Validation Tests
# ============================================================================

def test_orm_level_risk_score_validation():
    finding = RiskFinding(company_id=1, severity="medium", status="pending")
    # Valid
    finding.risk_score = 75.0
    assert finding.risk_score == 75.0

    # Below 0
    with pytest.raises(ValueError):
        finding.risk_score = -5.0

    # Above 100
    with pytest.raises(ValueError):
        finding.risk_score = 105.0


def test_orm_level_severity_validation():
    finding = RiskFinding(company_id=1, risk_score=50.0, status="pending")
    with pytest.raises(ValueError):
        finding.severity = "invalid_severity"


def test_orm_level_asset_type_validation():
    asset = ProtectedAsset(company_id=1, value="brand")
    with pytest.raises(ValueError):
        asset.asset_type = "unsupported"
