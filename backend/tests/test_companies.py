def test_create_and_get_company(client):
    payload = {
        "name": "Acme Cyber Security",
        "domain": "acme-cyber.com",
        "industry": "Defense",
        "description": "Critical infrastructure contractor",
    }
    create_res = client.post("/api/v1/companies/", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["id"] is not None
    assert created_data["name"] == payload["name"]
    assert created_data["domain"] == payload["domain"]
    assert created_data["overall_risk_score"] == 0.0

    # Retrieve
    company_id = created_data["id"]
    get_res = client.get(f"/api/v1/companies/{company_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == payload["name"]


def test_duplicate_company_name_fails(client):
    payload = {
        "name": "Unique Corp",
        "domain": "unique-corp.com",
    }
    res1 = client.post("/api/v1/companies/", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/companies/", json=payload)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_get_nonexistent_company_returns_404(client):
    res = client.get("/api/v1/companies/99999")
    assert res.status_code == 404


def test_update_company(client):
    create_res = client.post("/api/v1/companies/", json={
        "name": "Beta Corp",
        "domain": "betacorp.io",
    })
    company_id = create_res.json()["id"]

    update_res = client.put(f"/api/v1/companies/{company_id}", json={
        "industry": "FinTech",
        "description": "Financial technologies provider",
    })
    assert update_res.status_code == 200
    assert update_res.json()["industry"] == "FinTech"


def test_delete_company(client):
    create_res = client.post("/api/v1/companies/", json={
        "name": "Delete Me",
        "domain": "deleteme.com",
    })
    company_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/companies/{company_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/v1/companies/{company_id}")
    assert get_res.status_code == 404
