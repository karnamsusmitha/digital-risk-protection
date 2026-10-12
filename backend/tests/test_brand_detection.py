import pytest
from app.models import Company, ProtectedAsset
from app.services.brand_detection import (
    normalize_brand_text,
    canonicalize_for_similarity,
    levenshtein_distance,
    compute_string_similarity,
    detect_homoglyphs,
    detect_lookalike_brand_name,
    extract_domain_components,
    detect_suspicious_domain_variation,
    evaluate_brand_impersonation,
)


# ============================================================================
# 1. Text Normalization & Canonicalization Tests
# ============================================================================

def test_normalize_brand_text_strips_legal_suffixes_and_punctuation():
    assert normalize_brand_text("Acme Corp Inc.") == "acme"
    assert normalize_brand_text("Google LLC") == "google"
    assert normalize_brand_text("Microsoft Corporation") == "microsoft"
    assert normalize_brand_text("Apple, Inc.") == "apple"
    assert normalize_brand_text("Stripe Payments Ltd.") == "stripe"
    assert normalize_brand_text("   Nike   Global   Group   ") == "nike"
    assert normalize_brand_text("Initech Solutions GMBH") == "initech"
    # Preserves standalone brand
    assert normalize_brand_text("Acme") == "acme"
    assert normalize_brand_text("") == ""
    assert normalize_brand_text(None) == ""


def test_canonicalize_and_homoglyphs():
    # Cyrillic 'а' (U+0430) looks identical to Latin 'a'
    cyrillic_paypal = "p\u0430ypal"  # 'pаypal'
    has_homo, decoded, details = detect_homoglyphs(cyrillic_paypal)
    assert has_homo is True
    assert decoded == "paypal"
    assert len(details) == 1
    assert "U+0430" in details[0]

    # Leetspeak numbers
    leetspeak_brand = "m1cr0s0ft"
    has_leet, decoded_leet, details_leet = detect_homoglyphs(leetspeak_brand)
    assert has_leet is True
    assert decoded_leet == "microsoft"


# ============================================================================
# 2. String Similarity Computation Tests
# ============================================================================

def test_string_similarity_deterministic_ratios():
    # Exact match
    assert compute_string_similarity("Acme Corp", "Acme Corp") == 1.0
    assert compute_string_similarity("Google", "google") == 1.0

    # High similarity typos
    typo_sim = compute_string_similarity("Microsft", "Microsoft")
    assert typo_sim >= 0.85

    typo_sim2 = compute_string_similarity("Googel", "Google")
    assert typo_sim2 >= 0.80

    # Token reordering
    reorder_sim = compute_string_similarity("Acme Cyber Security", "Security Acme Cyber")
    assert reorder_sim >= 0.85

    # Completely unrelated names
    unrelated_sim1 = compute_string_similarity("Acme", "Zebra Technologies")
    assert unrelated_sim1 < 0.35

    unrelated_sim2 = compute_string_similarity("Amazon", "Netflix")
    assert unrelated_sim2 < 0.35


# ============================================================================
# 3. Domain Component Extraction & Normalization Tests
# ============================================================================

def test_extract_domain_components():
    res1 = extract_domain_components("https://login.acme-corp.com/auth/portal?src=web")
    assert res1["host"] == "login.acme-corp.com"
    assert res1["subdomain"] == "login"
    assert res1["sld"] == "acme-corp"
    assert res1["tld"] == "com"
    assert res1["registered_domain"] == "acme-corp.com"

    res2 = extract_domain_components("acme.co.uk")
    assert res2["sld"] == "acme"
    assert res2["tld"] == "co.uk"


# ============================================================================
# 4. Legitimate Assets Tests (Official Whitelist Exclusions)
# ============================================================================

def test_legitimate_official_assets_excluded():
    official_domains = ["acme-corp.com", "portal.acme-corp.com"]
    official_brands = ["Acme Corp", "Acme Security"]

    # 1. Exact official domain
    res1 = evaluate_brand_impersonation(
        candidate_name="Acme Portal",
        candidate_domain="https://acme-corp.com/login",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )
    assert res1.is_official_match is True
    assert res1.risk_score == 0.0
    assert res1.severity == "LOW"
    assert "Exact match to verified official entity" in " ".join(res1.reasons)

    # 2. Exact official brand name
    res2 = evaluate_brand_impersonation(
        candidate_name="Acme Corp",
        candidate_domain="https://portal.acme-corp.com",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )
    assert res2.is_official_match is True
    assert res2.risk_score == 0.0
    assert res2.severity == "LOW"


# ============================================================================
# 5. Similar Names Alone (Explainability & Cap Test)
# ============================================================================

def test_similar_names_alone_not_classified_as_malicious():
    """
    Requirement 8: Do not classify an asset as malicious based only on name similarity.
    Score must be capped (< 35 pts, LOW severity) and reason must explain this policy.
    """
    official_brands = ["Acme Security Global"]
    official_domains = ["acme-security.com"]

    # Candidate has a similar brand name ("Acme Security Supplies"), but an unrelated domain
    res = evaluate_brand_impersonation(
        candidate_name="Acme Security Supplies",
        candidate_domain="https://unrelated-supplies-store.org",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )

    # High similarity due to word overlap
    assert res.name_similarity >= 0.70
    assert res.is_name_lookalike is True

    # Must be capped at LOW severity (< 35.0)
    assert res.risk_score < 35.0
    assert res.severity == "LOW"

    # Must explicitly state policy in reasons
    reasons_text = " ".join(res.reasons)
    assert "Name resemblance alone is not classified as fraudulent" in reasons_text


# ============================================================================
# 6. Suspicious Domain Variations Tests
# ============================================================================

def test_suspicious_domain_combosquatting_credential_harvesting():
    official_brands = ["Acme Cyber"]
    official_domains = ["acme-cyber.com"]

    # Combosquatting with login/auth keyword
    res = evaluate_brand_impersonation(
        candidate_name="Acme Login",
        candidate_domain="https://acme-cyber-login.com",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )

    assert res.is_domain_variation is True
    assert "combosquatting_credential_harvesting" in res.variation_types
    # Elevated risk score and severity
    assert res.risk_score >= 45.0
    assert res.severity in ("MEDIUM", "HIGH", "CRITICAL")
    assert any("credential-harvesting" in r.lower() for r in res.reasons)


def test_suspicious_domain_deceptive_subdomain():
    official_brands = ["Acme Financial"]
    official_domains = ["acmefinancial.com"]

    # Deceptive subdomain: brand spoofed under external apex host
    res = evaluate_brand_impersonation(
        candidate_name="Acme Online Banking",
        candidate_domain="https://acmefinancial.com.phishing-hub.net/verify",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )

    assert res.is_domain_variation is True
    assert "deceptive_subdomain_spoofing" in res.variation_types
    assert res.risk_score >= 45.0
    assert res.severity in ("MEDIUM", "HIGH", "CRITICAL")
    assert any("deceptive subdomain" in r.lower() for r in res.reasons)


def test_suspicious_domain_typosquatting():
    official_brands = ["Acme"]
    official_domains = ["acme.com"]

    # Typosquatting (omission or transposition)
    res = evaluate_brand_impersonation(
        candidate_name="Acme",
        candidate_domain="https://acmme.com",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )

    assert res.is_domain_variation is True
    assert "typosquatting" in res.variation_types
    assert res.risk_score >= 35.0
    assert any("typosquatting" in r.lower() for r in res.reasons)


def test_suspicious_domain_risky_tld_swap():
    official_brands = ["Acme Payments"]
    official_domains = ["acme-payments.com"]

    # Brand on high-abuse .xyz TLD
    res = evaluate_brand_impersonation(
        candidate_name="Acme Payments",
        candidate_domain="https://acme-payments.xyz",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )

    assert res.is_domain_variation is True
    assert "risky_tld_swap" in res.variation_types
    assert res.risk_score >= 35.0
    assert any("tld" in r.lower() for r in res.reasons)


# ============================================================================
# 7. Unrelated Names & Domains Tests
# ============================================================================

def test_unrelated_names_and_domains():
    official_brands = ["Acme Cyber Corp"]
    official_domains = ["acme-corp.com"]

    # Candidate with completely unrelated brand and domain
    res = evaluate_brand_impersonation(
        candidate_name="Blue Mountain Coffee Roasters",
        candidate_domain="https://bluemountain-beans.net",
        official_brand_names=official_brands,
        official_domains=official_domains,
    )

    assert res.name_similarity < 0.35
    assert res.is_name_lookalike is False
    assert res.is_domain_variation is False
    assert res.is_official_match is False
    assert res.risk_score == 0.0
    assert res.severity == "LOW"
    assert "No suspicious brand resemblance" in " ".join(res.reasons)


# ============================================================================
# 8. API Endpoint Integration Test
# ============================================================================

def test_detect_brand_impersonation_api_endpoint(client, db_session):
    # Setup company with official brand and domain
    comp = Company(name="FinTech Sentinel", domain="fintechsentinel.com")
    db_session.add(comp)
    db_session.commit()
    db_session.refresh(comp)

    asset = ProtectedAsset(
        company_id=comp.id,
        asset_type="domain",
        value="secure.fintechsentinel.com",
    )
    db_session.add(asset)
    db_session.commit()

    # 1. Test exact legitimate asset via API
    res_legit = client.post(
        "/api/v1/analysis/detect-brand-impersonation",
        json={
            "company_id": comp.id,
            "candidate_domain": "https://secure.fintechsentinel.com/login",
        },
    )
    assert res_legit.status_code == 200
    legit_data = res_legit.json()
    assert legit_data["is_official_match"] is True
    assert legit_data["risk_score"] == 0.0
    assert legit_data["severity"] == "LOW"

    # 2. Test combosquatting phishing domain via API
    res_threat = client.post(
        "/api/v1/analysis/detect-brand-impersonation",
        json={
            "company_id": comp.id,
            "candidate_name": "FinTech Sentinel Login Portal",
            "candidate_domain": "https://fintechsentinel-login.com",
            "context_indicators": ["active_dns"],
        },
    )
    assert res_threat.status_code == 200
    threat_data = res_threat.json()
    assert threat_data["is_official_match"] is False
    assert threat_data["is_domain_variation"] is True
    assert threat_data["risk_score"] >= 60.0
    assert threat_data["severity"] in ("HIGH", "CRITICAL")
    assert len(threat_data["reasons"]) > 0

    # 3. Test similar name alone via API
    res_similar = client.post(
        "/api/v1/analysis/detect-brand-impersonation",
        json={
            "company_id": comp.id,
            "candidate_name": "FinTech Sentinel Hardware Inc",
            "candidate_domain": "https://unrelated-hardware-shop.org",
        },
    )
    assert res_similar.status_code == 200
    similar_data = res_similar.json()
    assert similar_data["risk_score"] < 35.0
    assert similar_data["severity"] == "LOW"
    assert "alone is not classified as fraudulent" in " ".join(similar_data["reasons"])
