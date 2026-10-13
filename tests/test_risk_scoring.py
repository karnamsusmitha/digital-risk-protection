"""
Comprehensive unit tests for the decoupled RiskScoringService.

Covers:
- Official registered assets (domains, URLs, social profiles, mobile apps).
- Look-alike domains (typosquatting, homoglyphs, TLD swaps, subdomain spoofing).
- Unrelated domains and benign brand mentions.
- Suspicious social profile handles.
- Mobile app listings with unauthorized modifiers.
- Invalid inputs and safe parsing rejections.
- Exact boundary scores (0, 24, 25, 49, 50, 74, 75, 100) and custom score bands.
- Supplied evidence evaluation (redirect mismatches, displayed URL mismatches).
- Missing evidence guarantees (no invented threat intel or reputation penalties).
- Independence from API routes and databases.
"""

import pytest
from app.services.risk_scoring import (
    RiskScoringService,
    BrandAssetContext,
    CandidateEvidence,
    CandidateAssetType,
    ScoreBands,
    RiskScoringWeights,
    normalize_asset_type
)
from app.models import Brand


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def default_service() -> RiskScoringService:
    """Standard risk scoring service with baseline weights and score bands."""
    return RiskScoringService()


@pytest.fixture
def acme_brand() -> BrandAssetContext:
    """Sample brand context with registered official assets."""
    return BrandAssetContext(
        brand_id=101,
        name="Acme Bank",
        description="Global financial services provider",
        official_domains=["acmebank.com", "acmeglobal.com"],
        official_urls=["https://acmebank.com/login", "https://acmeglobal.com/portal"],
        official_social_handles=["@acmebank", "@acmeglobal_official"],
        official_app_names=["Acme Bank Mobile", "Acme Global Banking"]
    )


# ---------------------------------------------------------------------------
# 1. Official Registered Assets (Requirement 8)
# ---------------------------------------------------------------------------

def test_official_exact_domain_returns_zero_risk(default_service, acme_brand):
    """Exact official domain must score 0 and never be flagged as an impersonator."""
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmebank.com",
        brand=acme_brand
    )
    assert result.score == 0
    assert result.category == "Low"
    assert result.is_official_asset is True
    assert len(result.indicators) == 1
    assert result.indicators[0]["code"] == "OFFICIAL_ASSET_VERIFIED"
    assert "No action required" in result.recommended_action
    assert "No action required" in result.recommended_next_action
    assert result.brand_name == "Acme Bank"


def test_official_domain_www_and_case_variations(default_service, acme_brand):
    """Subdomain 'www' and case-insensitive official matches must also score 0."""
    res_www = default_service.analyze(
        candidate_type="domain",
        candidate_value="WWW.ACMEBANK.COM",
        brand=acme_brand
    )
    assert res_www.score == 0
    assert res_www.category == "Low"
    assert res_www.is_official_asset is True

    # When candidate is in official domains list without www
    res_global = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmeglobal.com",
        brand=acme_brand
    )
    assert res_global.score == 0
    assert res_global.is_official_asset is True


def test_official_url_returns_zero_risk(default_service, acme_brand):
    """Official URLs or URLs hosted on official domains must return zero risk."""
    res_url = default_service.analyze(
        candidate_type="url",
        candidate_value="https://acmebank.com/login",
        brand=acme_brand
    )
    assert res_url.score == 0
    assert res_url.is_official_asset is True
    assert res_url.category == "Low"

    # URL on official domain with custom path
    res_path = default_service.analyze(
        candidate_type="url",
        candidate_value="https://acmebank.com/accounts/overview",
        brand=acme_brand
    )
    assert res_path.score == 0
    assert res_path.is_official_asset is True


def test_official_social_profile_returns_zero_risk(default_service, acme_brand):
    """Official social media profile handles must return zero risk."""
    res_handle = default_service.analyze(
        candidate_type="social_profile",
        candidate_value="@acmebank",
        brand=acme_brand
    )
    assert res_handle.score == 0
    assert res_handle.is_official_asset is True
    assert res_handle.category == "Low"

    # With full social network URL
    res_url = default_service.analyze(
        candidate_type="social profile",
        candidate_value="https://twitter.com/acmeglobal_official",
        brand=acme_brand
    )
    assert res_url.score == 0
    assert res_url.is_official_asset is True


def test_official_app_listing_returns_zero_risk(default_service, acme_brand):
    """Registered official app name must return zero risk."""
    res_app = default_service.analyze(
        candidate_type="app listing",
        candidate_value="Acme Bank Mobile",
        brand=acme_brand
    )
    assert res_app.score == 0
    assert res_app.is_official_asset is True
    assert res_app.category == "Low"


# ---------------------------------------------------------------------------
# 2. Look-Alike Domains (Typosquatting, Homoglyphs, TLD Swaps, Spoofing)
# ---------------------------------------------------------------------------

def test_typosquatting_edit_distance_1(default_service, acme_brand):
    """Edit distance 1 against registered brand triggers typosquatting indicator."""
    # 'acmebanck' has 1 character insertion ('c') compared to 'acmebank'
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmebanck.org",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "TYPOSQUAT_DISTANCE_1" in codes
    assert result.score >= 35
    assert result.category in ("Medium", "High", "Critical")


def test_typosquatting_edit_distance_2(default_service, acme_brand):
    """Edit distance 2 against registered brand triggers lookalike indicator."""
    # 'acmebanx' vs 'acmebank' -> 1 substitution, but let's test distance 2: 'acmebannk1'
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmebaankk.net",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "TYPOSQUAT_DISTANCE_2" in codes
    assert result.score >= 20


def test_homoglyph_substitution_lookalike(default_service, acme_brand):
    """Homoglyph visual lookalike substitution (e.g. '0' for 'o', '1' for 'l') triggers indicator."""
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmeg1oba1.com",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "HOMOGLYPH_SUBSTITUTION" in codes
    assert result.score >= 35


def test_tld_swap_squatting(default_service, acme_brand):
    """Exact SLD of official domain under alternative or abuse-prone TLD triggers TLD swap."""
    # Official domain is acmebank.com, candidate is acmebank.xyz
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmebank.xyz",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "TLD_SWAP_SQUATTING" in codes
    assert result.score >= 25


def test_subdomain_brand_spoofing(default_service, acme_brand):
    """Brand name appearing in subdomain prefix of third-party root domain triggers critical flag."""
    result = default_service.analyze(
        candidate_type="url",
        candidate_value="https://acmebank.account-verify.phishingserver.org/login",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "SUBDOMAIN_SPOOFING" in codes
    assert "DECEPTIVE_SECURITY_KEYWORD" in codes
    assert result.score >= 50
    assert result.category in ("High", "Critical")


def test_compound_lookalike_critical_score(default_service, acme_brand):
    """Compound attack (homoglyph + deceptive keywords + abuse TLD) hits Critical band."""
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmeg1oba1-login-verify-security.xyz",
        brand=acme_brand
    )
    # Homoglyph (35) + Deceptive keywords (30) + Suspicious TLD (20) + Hyphens (15) = 100
    assert result.score >= 75
    assert result.category == "Critical"
    assert "Immediate triage" in result.recommended_action


# ---------------------------------------------------------------------------
# 3. Unrelated Domains & Benign Brand Mentions (Requirement 8 & 9)
# ---------------------------------------------------------------------------

def test_completely_unrelated_domain_returns_low_risk(default_service, acme_brand):
    """Completely unrelated domain must produce zero anomalous score and Low category."""
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="global-weather-daily-forecast.org",
        brand=acme_brand
    )
    assert result.score == 0
    assert result.category == "Low"
    assert result.indicators[0]["code"] == "NO_ANOMALOUS_INDICATORS"
    assert "Monitor asset" in result.recommended_action


def test_benign_brand_name_mention_not_labeled_fraudulent(default_service):
    """
    Brand name mentioned without typosquatting, deceptive keywords, or spoofing
    must remain strictly in the Low score band (<= 24).
    """
    apex_brand = BrandAssetContext(
        brand_id=202,
        name="Apex",
        official_domains=["apexcorp.com"]
    )
    result = default_service.analyze(
        candidate_type="domain",
        candidate_value="apexcommunity.org",
        brand=apex_brand
    )
    # Score must stay <= 24 (Low band)
    assert result.score <= 24
    assert result.category == "Low"
    codes = [i["code"] for i in result.indicators]
    assert "NAME_MENTION_UNVERIFIED" in codes
    assert "Preliminary low-risk mention" in result.indicators[0]["explanation"]


# ---------------------------------------------------------------------------
# 4. Suspicious Social Media Profile Names
# ---------------------------------------------------------------------------

def test_suspicious_social_profile_name(default_service, acme_brand):
    """Social profile incorporating brand name plus sensitive support/giveaway keyword is flagged."""
    result = default_service.analyze(
        candidate_type="social_profile",
        candidate_value="@acmebank_support_helpdesk",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "SUSPICIOUS_SOCIAL_PROFILE" in codes
    assert result.score >= 25
    assert result.category in ("Medium", "High")


def test_benign_social_profile_unrelated(default_service, acme_brand):
    """Unrelated social profile handle produces zero score."""
    result = default_service.analyze(
        candidate_type="social_profile",
        candidate_value="@random_food_blogger_123",
        brand=acme_brand
    )
    assert result.score == 0
    assert result.category == "Low"


# ---------------------------------------------------------------------------
# 5. Mobile App Listings
# ---------------------------------------------------------------------------

def test_suspicious_app_listing_modifiers(default_service, acme_brand):
    """App listing with unauthorized crack/hack/generator modifiers is flagged."""
    result = default_service.analyze(
        candidate_type="app listing",
        candidate_value="Acme Bank Unlimited Cash Hack Mod Generator",
        brand=acme_brand
    )
    codes = [i["code"] for i in result.indicators]
    assert "SUSPICIOUS_APP_TITLE_MODIFIER" in codes
    assert result.score >= 35
    assert result.category in ("Medium", "High", "Critical")


# ---------------------------------------------------------------------------
# 6. Invalid Inputs & Safe Static Parsing
# ---------------------------------------------------------------------------

def test_empty_and_whitespace_candidate_rejected(default_service):
    """Empty or whitespace-only candidates must raise ValueError."""
    with pytest.raises(ValueError, match="cannot be empty"):
        default_service.analyze(candidate_type="domain", candidate_value="")

    with pytest.raises(ValueError, match="cannot be empty"):
        default_service.analyze(candidate_type="domain", candidate_value="   ")


def test_unsupported_candidate_type_rejected(default_service):
    """Unknown candidate types must raise ValueError."""
    with pytest.raises(ValueError, match="Unsupported candidate asset type"):
        default_service.analyze(candidate_type="executable_binary", candidate_value="test.exe")


def test_unsafe_url_schemes_rejected(default_service):
    """Unsafe or executable URL schemes must be rejected."""
    unsafe_schemes = [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html;base64,PHNjcmlwdD4=",
        "vbscript:msgbox",
    ]
    for unsafe_url in unsafe_schemes:
        with pytest.raises(ValueError, match="Unsupported or unsafe URL scheme"):
            default_service.analyze(candidate_type="url", candidate_value=unsafe_url)


def test_url_missing_host_rejected(default_service):
    """URL without a valid hostname must raise ValueError."""
    with pytest.raises(ValueError, match="must include a valid host"):
        default_service.analyze(candidate_type="url", candidate_value="http://")


def test_malformed_domain_rejected(default_service):
    """Domain without top-level structure must raise ValueError."""
    with pytest.raises(ValueError, match="Domain value is invalid"):
        default_service.analyze(candidate_type="domain", candidate_value="nodotsinthisstring")


# ---------------------------------------------------------------------------
# 7. Boundary Scores & Configurable Score Bands (Requirements 5 & 6)
# ---------------------------------------------------------------------------

def test_score_band_boundaries_mapping():
    """Verify exact boundary values for default configurable score bands."""
    bands = ScoreBands()
    # 0–24: Low
    assert bands.get_category(0) == "Low"
    assert bands.get_category(24) == "Low"
    # 25–49: Medium
    assert bands.get_category(25) == "Medium"
    assert bands.get_category(49) == "Medium"
    # 50–74: High
    assert bands.get_category(50) == "High"
    assert bands.get_category(74) == "High"
    # 75–100: Critical
    assert bands.get_category(75) == "Critical"
    assert bands.get_category(100) == "Critical"


def test_score_clamping_to_zero_and_hundred():
    """Scores must strictly clamp within [0, 100]."""
    service = RiskScoringService()
    # Trigger multiple high-impact rules that sum past 100
    res = service.analyze(
        candidate_type="domain",
        candidate_value="acm3-login-verify-security-portal.xyz",
        brand=BrandAssetContext(name="Acme", official_domains=["acme.com"]),
        evidence={"redirect_url": "http://evil-destination.net"}
    )
    assert res.score == 100
    assert res.category == "Critical"


def test_custom_score_bands_configuration(acme_brand):
    """Verify that score bands are configurable and dynamically alter categorization."""
    # Custom bands: Low: 0-19, Medium: 20-59, High: 60-79, Critical: 80-100
    custom_bands = ScoreBands(
        bands={
            "Low": (0, 19),
            "Medium": (20, 59),
            "High": (60, 79),
            "Critical": (80, 100)
        }
    )
    custom_service = RiskScoringService(score_bands=custom_bands)

    # Score of 20 with default bands would be Low, but with custom bands is Medium
    assert custom_bands.get_category(20) == "Medium"
    assert custom_bands.get_category(19) == "Low"
    assert custom_bands.get_category(79) == "High"
    assert custom_bands.get_category(80) == "Critical"


def test_exact_boundary_scenarios(default_service):
    """
    Test real asset evaluations that land precisely on score band transition points:
    - 0: Official or completely unrelated domain -> Low
    - 15 (<= 24): Benign brand name mention -> Low
    - 25: TLD swap squatting under abuse TLD -> Medium (lower bound of Medium)
    - 50: Homoglyph (35) + 1 keyword (15) -> High (lower bound of High)
    - 75: Subdomain spoofing (40) + Homoglyph (35) -> Critical (lower bound of Critical)
    """
    brand = BrandAssetContext(name="Acme Bank", official_domains=["acmebank.com"])

    # Score 0 (Low bound 0)
    res_0 = default_service.analyze(candidate_type="domain", candidate_value="acmebank.com", brand=brand)
    assert res_0.score == 0
    assert res_0.category == "Low"

    # Score 15 (Low upper region <= 24)
    res_15 = default_service.analyze(candidate_type="domain", candidate_value="acmecommunity.org", brand=brand)
    assert res_15.score == 15
    assert res_15.category == "Low"

    # Score 25 (Medium boundary 25)
    res_25 = default_service.analyze(candidate_type="domain", candidate_value="acmebank.xyz", brand=brand)
    assert res_25.score == 25
    assert res_25.category == "Medium"

    # Score 50 (High boundary 50): homoglyph (35) + 1 keyword 'login' (15)
    res_50 = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmeg1oba1-login.com",
        brand=BrandAssetContext(name="Acme Global", official_domains=["acmeglobal.com"])
    )
    assert res_50.score == 50
    assert res_50.category == "High"

    # Score 75 (Critical boundary 75): subdomain spoofing (40) + abuse TLD (20) + keyword 'login' (15)
    res_75 = default_service.analyze(
        candidate_type="url",
        candidate_value="https://acmebank.attacker.xyz/login",
        brand=brand
    )
    assert res_75.score == 75
    assert res_75.category == "Critical"


# ---------------------------------------------------------------------------
# 8. Supplied Evidence & Missing Evidence Guarantees (Requirements 4 & 9)
# ---------------------------------------------------------------------------

def test_missing_evidence_is_not_penalized(default_service, acme_brand):
    """
    Requirement 9: Missing evidence must not be treated as proof of malicious activity.
    When no redirect or threat intel evidence is provided, no penalty is applied.
    """
    res = default_service.analyze(
        candidate_type="domain",
        candidate_value="acmecommunity.org",
        brand=acme_brand,
        evidence=None
    )
    # Evidence sources report not provided/not configured without penalty
    assert res.evidence_source["redirect_evidence"] == "not_provided"
    assert res.evidence_source["external_threat_intel"]["configured"] is False
    assert "not treated as proof of malicious activity" in res.evidence_source["external_threat_intel"]["detail"]
    assert res.score <= 24


def test_supplied_redirect_mismatch_triggers_indicator(default_service, acme_brand):
    """Supplied redirect mismatch to an unverified third-party host triggers indicator."""
    evidence = CandidateEvidence(
        redirect_url="https://attacker-stealer-host.net/harvest"
    )
    res = default_service.analyze(
        candidate_type="url",
        candidate_value="https://acme-update-info.org",
        brand=acme_brand,
        evidence=evidence
    )
    codes = [i["code"] for i in res.indicators]
    assert "REDIRECT_URL_MISMATCH" in codes
    assert res.evidence_source["redirect_evidence"] == "supplied"


def test_supplied_redirect_to_official_domain_not_penalized(default_service, acme_brand):
    """Supplied redirect that resolves to a registered official brand domain is not penalized."""
    evidence = CandidateEvidence(
        redirect_url="https://acmebank.com/login"
    )
    res = default_service.analyze(
        candidate_type="url",
        candidate_value="https://acme-redirector-short.link",
        brand=acme_brand,
        evidence=evidence
    )
    codes = [i["code"] for i in res.indicators]
    assert "REDIRECT_URL_MISMATCH" not in codes
    assert "REDIRECT_TO_OFFICIAL_ASSET" in codes


def test_supplied_displayed_url_mismatch(default_service, acme_brand):
    """Supplied displayed URL mismatch (masquerading link text) triggers indicator."""
    evidence = CandidateEvidence(
        displayed_url="https://acmebank.com"
    )
    res = default_service.analyze(
        candidate_type="url",
        candidate_value="https://phishing-catcher.net/auth",
        brand=acme_brand,
        evidence=evidence
    )
    codes = [i["code"] for i in res.indicators]
    assert "DISPLAYED_URL_MISMATCH" in codes


def test_verified_external_threat_intelligence_integration(acme_brand):
    """Verified external threat intelligence from configured source is recorded."""
    class MockVirusTotalProvider:
        def check_threat(self, candidate_type: str, candidate_value: str):
            if "malware" in candidate_value:
                return {
                    "source": "VirusTotal Intelligence",
                    "threat_type": "phishing / credential harvester",
                    "verified_threat": True
                }
            return None

    service_with_intel = RiskScoringService(threat_intel_provider=MockVirusTotalProvider())

    # Candidate matches threat intelligence
    res = service_with_intel.analyze(
        candidate_type="domain",
        candidate_value="malware-acme-portal.com",
        brand=acme_brand
    )
    codes = [i["code"] for i in res.indicators]
    assert "EXTERNAL_THREAT_INTEL_MATCH" in codes
    assert res.score >= 50
    assert res.evidence_source["external_threat_intel"]["configured"] is True


# ---------------------------------------------------------------------------
# 9. Service Decoupling & API Route Independence (Requirement 10)
# ---------------------------------------------------------------------------

def test_service_independent_of_fastapi_and_database():
    """RiskScoringService can run in pure memory without HTTP requests or database connections."""
    pure_service = RiskScoringService()
    pure_brand = BrandAssetContext(name="Zeus Security", official_domains=["zeus.io"])
    res = pure_service.analyze(
        candidate_type="domain",
        candidate_value="zeus-login-auth.xyz",
        brand=pure_brand
    )
    assert isinstance(res.score, int)
    assert res.category in ("Low", "Medium", "High", "Critical")
    assert isinstance(res.indicators, list)
    assert isinstance(res.explanations, list)
    assert isinstance(res.evidence_source, dict)
    assert len(res.recommended_action) > 0


def test_service_with_database_session(db_session):
    """Service can optionally resolve Brand directly from database session when brand_id is given."""
    # Create brand in DB
    db_brand = Brand(
        name="Titan Cloud",
        official_domains=["titancloud.io"],
        official_urls=["https://titancloud.io"],
        official_social_handles=["@titancloud"]
    )
    db_session.add(db_brand)
    db_session.commit()
    db_session.refresh(db_brand)

    service = RiskScoringService()
    res = service.analyze(
        candidate_type="domain",
        candidate_value="titancloud.io",
        brand_id=db_brand.id,
        db=db_session
    )
    assert res.is_official_asset is True
    assert res.score == 0
    assert res.brand_name == "Titan Cloud"

    # Nonexistent brand ID with DB raises ValueError
    with pytest.raises(ValueError, match="not found"):
        service.analyze(
            candidate_type="domain",
            candidate_value="test.com",
            brand_id=99999,
            db=db_session
        )
