def test_create_and_get_brand(client):
    payload = {
        "name": "Acme Global",
        "description": "Global enterprise security solutions",
        "official_domains": ["acmeglobal.com", "acme-portal.com"],
        "official_urls": ["https://acmeglobal.com/login"],
        "official_social_handles": ["@acmeglobal", "@acme_support"]
    }
    create_res = client.post("/api/brands", json=payload)
    assert create_res.status_code == 201
    created_data = create_res.json()
    assert created_data["id"] is not None
    assert created_data["name"] == "Acme Global"
    assert len(created_data["official_domains"]) == 2

    # Get by ID
    brand_id = created_data["id"]
    get_res = client.get(f"/api/brands/{brand_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Acme Global"


def test_duplicate_brand_rejected(client):
    payload = {
        "name": "UniqueCorp",
        "official_domains": ["uniquecorp.com"]
    }
    res1 = client.post("/api/brands", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/brands", json=payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"]


def test_list_brands_pagination(client):
    for i in range(5):
        client.post("/api/brands", json={
            "name": f"Brand {i}",
            "official_domains": [f"brand{i}.com"]
        })

    list_res = client.get("/api/brands?limit=3&offset=0")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 3

    list_res_next = client.get("/api/brands?limit=3&offset=3")
    assert list_res_next.status_code == 200
    assert len(list_res_next.json()) == 2


def test_update_brand(client):
    create_res = client.post("/api/brands", json={
        "name": "Original Name",
        "official_domains": ["original.com"]
    })
    brand_id = create_res.json()["id"]

    update_res = client.put(f"/api/brands/{brand_id}", json={
        "name": "Updated Name",
        "official_domains": ["original.com", "updated.com"]
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Updated Name"
    assert len(updated_data["official_domains"]) == 2


def test_delete_brand(client):
    create_res = client.post("/api/brands", json={"name": "To Delete"})
    brand_id = create_res.json()["id"]

    del_res = client.delete(f"/api/brands/{brand_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/brands/{brand_id}")
    assert get_res.status_code == 404
