def test_official_domain_returns_zero_risk(client):
    brand_res = client.post("/api/brands", json={
        "name": "Acme Bank",
        "official_domains": ["acmebank.com"],
        "official_urls": ["https://acmebank.com/portal"],
        "official_social_handles": ["@acmebank"]
    })
    brand_id = brand_res.json()["id"]

    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "acmebank.com",
        "brand_id": brand_id
    })
    assert scan_res.status_code == 201
    scan_data = scan_res.json()
    assert scan_data["risk_score"] == 0
    assert scan_data["risk_category"] == "Low"
    assert scan_data["indicators"][0]["code"] == "OFFICIAL_ASSET_VERIFIED"
    assert scan_data["brand_name"] == "Acme Bank"


def test_typosquatting_and_keywords_trigger_high_risk(client):
    brand_res = client.post("/api/brands", json={
        "name": "PayPal",
        "official_domains": ["paypal.com"]
    })
    brand_id = brand_res.json()["id"]

    # Typosquatting + deceptive keywords + suspicious TLD
    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "paypa1-security-login.xyz",
        "brand_id": brand_id
    })
    assert scan_res.status_code == 201
    scan_data = scan_res.json()
    assert scan_data["risk_score"] >= 60
    assert scan_data["risk_category"] in ("High", "Critical")

    codes = [i["code"] for i in scan_data["indicators"]]
    assert "DECEPTIVE_SECURITY_KEYWORD" in codes
    assert "SUSPICIOUS_TLD" in codes


def test_subdomain_spoofing_trigger(client):
    brand_res = client.post("/api/brands", json={
        "name": "Google",
        "official_domains": ["google.com"]
    })
    brand_id = brand_res.json()["id"]

    scan_res = client.post("/api/scans", json={
        "candidate_type": "url",
        "candidate_value": "https://google.account-verify.attacker.xyz/login",
        "brand_id": brand_id
    })
    assert scan_res.status_code == 201
    scan_data = scan_res.json()
    assert scan_data["risk_score"] >= 60

    codes = [i["code"] for i in scan_data["indicators"]]
    assert "SUBDOMAIN_SPOOFING" in codes
    assert "DECEPTIVE_SECURITY_KEYWORD" in codes


def test_name_alone_not_labeled_fraudulent(client):
    """
    Ensure rule adherence: Do not label an account or website as fraudulent based only on its name.
    """
    brand_res = client.post("/api/brands", json={
        "name": "Apex",
        "official_domains": ["apexcorp.com"]
    })
    brand_id = brand_res.json()["id"]

    # Just a benign name mention without deceptive keywords or homoglyphs
    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "apexcommunity.org",
        "brand_id": brand_id
    })
    assert scan_res.status_code == 201
    scan_data = scan_res.json()
    # Risk score should remain in Low category (<= 24)
    assert scan_data["risk_score"] <= 24
    assert scan_data["risk_category"] == "Low"


def test_mobile_app_suspicious_modifiers(client):
    scan_res = client.post("/api/scans", json={
        "candidate_type": "mobile_app",
        "candidate_value": "Acme Bank Unlimited Cash Hack Mod"
    })
    assert scan_res.status_code == 201
    scan_data = scan_res.json()
    codes = [i["code"] for i in scan_data["indicators"]]
    assert "SUSPICIOUS_APP_TITLE_MODIFIER" in codes


def test_invalid_url_rejected(client):
    res = client.post("/api/scans", json={
        "candidate_type": "url",
        "candidate_value": "javascript:alert(1)"
    })
    assert res.status_code == 400
    assert "Unsupported or unsafe URL scheme" in res.json()["detail"]


def test_filter_scans_and_update_status(client):
    # Create two scans
    client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "legit-site.com"
    })
    scan2 = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "bank-login-update-wallet.xyz"
    }).json()

    # List with status filter
    scans_list = client.get("/api/scans?status=review_needed")
    assert scans_list.status_code == 200

    # Update status to confirmed_threat
    patch_res = client.patch(f"/api/scans/{scan2['id']}/status", json={
        "status": "confirmed_threat"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "confirmed_threat"


def test_scan_with_evidence_and_recommendation_fields(client):
    brand_res = client.post("/api/brands", json={
        "name": "SecBank",
        "official_domains": ["secbank.com"]
    })
    brand_id = brand_res.json()["id"]

    scan_res = client.post("/api/scans", json={
        "candidate_type": "url",
        "candidate_value": "https://secbank-verify.com/portal",
        "brand_id": brand_id,
        "evidence": {
            "redirect_url": "https://malicious-harvesting-sinkhole.net/steal"
        }
    })
    assert scan_res.status_code == 201
    data = scan_res.json()
    assert data["risk_score"] >= 50
    assert data["recommended_action"] is not None
    assert len(data["recommended_action"]) > 0
    assert data["evidence_source"] is not None
    assert data["evidence_source"]["redirect_evidence"] == "supplied"
    assert len(data["explanations"]) >= 1
    codes = [i["code"] for i in data["indicators"]]
    assert "REDIRECT_URL_MISMATCH" in codes
