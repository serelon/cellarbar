def test_create_bottle_quick_add(client):
    r = client.post("/api/bottles", json={
        "name": "Barolo 2019", "type": "wine", "quantity": 1.0, "purchase_price_kr": 299,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Barolo 2019"
    assert data["quantity_purchased"] == 1.0
    assert data["status"] == "in_stock"
    assert data["enrichment_status"] == "pending"


def test_list_bottles_filter_by_type(client):
    client.post("/api/bottles", json={"name": "Wine A", "type": "wine", "quantity": 1})
    client.post("/api/bottles", json={"name": "Spirit A", "type": "spirit", "quantity": 1})
    r = client.get("/api/bottles?type=wine")
    assert all(b["type"] == "wine" for b in r.json())


def test_update_bottle(client):
    r = client.post("/api/bottles", json={"name": "Update Me", "type": "wine", "quantity": 1})
    bid = r.json()["id"]
    r = client.patch(f"/api/bottles/{bid}", json={"region": "Burgundy", "vintage": 2020})
    assert r.json()["region"] == "Burgundy"


def test_adjust_quantity_to_zero_marks_consumed(client):
    r = client.post("/api/bottles", json={"name": "Finish Me", "type": "wine", "quantity": 1.0})
    bid = r.json()["id"]
    r = client.post(f"/api/bottles/{bid}/adjust", json={"quantity": 0})
    assert r.json()["status"] == "consumed"


def test_create_bottle_with_tags(client):
    t = client.post("/api/tags", json={"name": "bold_test", "category": "flavor"})
    tag_id = t.json()["id"]
    r = client.post("/api/bottles", json={
        "name": "Tagged Wine", "type": "wine", "quantity": 1, "tag_ids": [tag_id],
    })
    assert len(r.json()["tags"]) == 1


def test_search_bottles(client):
    client.post("/api/bottles", json={"name": "Château Margaux", "type": "wine", "quantity": 1})
    r = client.get("/api/bottles?search=margaux")
    assert len(r.json()) >= 1
