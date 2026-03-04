def test_create_tag(client):
    r = client.post("/api/tags", json={"name": "fruity", "category": "flavor"})
    assert r.status_code == 201
    assert r.json()["name"] == "fruity"


def test_list_tags(client):
    client.post("/api/tags", json={"name": "gin", "category": "ingredient"})
    r = client.get("/api/tags")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_filter_tags_by_category(client):
    client.post("/api/tags", json={"name": "spicy", "category": "flavor"})
    client.post("/api/tags", json={"name": "rum", "category": "ingredient"})
    r = client.get("/api/tags?category=flavor")
    assert all(t["category"] == "flavor" for t in r.json())


def test_duplicate_tag_rejected(client):
    client.post("/api/tags", json={"name": "unique_tag", "category": "flavor"})
    r = client.post("/api/tags", json={"name": "unique_tag", "category": "flavor"})
    assert r.status_code == 409
