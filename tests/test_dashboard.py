def test_dashboard_summary_empty(client):
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_brands"] == 0
    assert data["total_scans"] == 0
    assert data["risk_distribution"]["Low"] == 0
    assert len(data["recent_scans"]) == 0


def test_dashboard_summary_populated(client):
    # Add a brand
    brand_res = client.post("/api/brands", json={"name": "Alpha Corp"})
    b_id = brand_res.json()["id"]

    # Add a benign scan
    client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "alpha-fans.org",
        "brand_id": b_id
    })

    # Add a high-risk scan
    client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "alphacorp-login-portal-auth.xyz",
        "brand_id": b_id
    })

    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_brands"] == 1
    assert data["total_scans"] == 2
    assert len(data["recent_scans"]) == 2
    assert len(data["findings_needing_review"]) >= 1
