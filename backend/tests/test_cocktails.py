def test_create_cocktail(client):
    r = client.post("/api/cocktails", json={
        "name": "Gin & Tonic",
        "method": "build",
        "difficulty": "easy",
        "ingredients": [
            {"name": "Gin", "amount_cl": 5},
            {"name": "Tonic Water", "is_pantry_item": True},
        ],
    })
    assert r.status_code == 201
    assert r.json()["name"] == "Gin & Tonic"
    assert len(r.json()["ingredients"]) == 2


def test_list_cocktails(client):
    client.post("/api/cocktails", json={"name": "Daiquiri", "method": "shake"})
    client.post("/api/cocktails", json={"name": "Old Fashioned", "method": "stir"})
    r = client.get("/api/cocktails")
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    assert "Daiquiri" in names
    assert "Old Fashioned" in names


def test_get_cocktail(client):
    created = client.post("/api/cocktails", json={"name": "Negroni", "method": "stir"}).json()
    r = client.get(f"/api/cocktails/{created['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == "Negroni"


def test_update_cocktail(client):
    created = client.post("/api/cocktails", json={"name": "Whiskey Sour", "method": "shake"}).json()
    r = client.patch(f"/api/cocktails/{created['id']}", json={"rating": 8})
    assert r.status_code == 200
    assert r.json()["rating"] == 8


def test_delete_cocktail(client):
    created = client.post("/api/cocktails", json={"name": "Mojito", "method": "build"}).json()
    r = client.delete(f"/api/cocktails/{created['id']}")
    assert r.status_code == 204
    r = client.get(f"/api/cocktails/{created['id']}")
    assert r.status_code == 404


def test_makeable_cocktails(client):
    gin_tag = client.post("/api/tags", json={"name": "gin_mk", "category": "ingredient"}).json()
    vermouth_tag = client.post("/api/tags", json={"name": "vermouth_mk", "category": "ingredient"}).json()

    client.post("/api/bottles", json={
        "name": "Beefeater", "type": "spirit", "quantity": 1,
        "tag_ids": [gin_tag["id"]],
    })

    client.post("/api/cocktails", json={
        "name": "Martini", "method": "stir",
        "ingredients": [
            {"name": "Gin", "amount_cl": 6, "tag_id": gin_tag["id"]},
            {"name": "Dry Vermouth", "amount_cl": 1, "tag_id": vermouth_tag["id"]},
        ],
    })

    r = client.get("/api/cocktails/makeable")
    names = [c["name"] for c in r.json()]
    assert "Martini" not in names

    client.post("/api/bottles", json={
        "name": "Noilly Prat", "type": "spirit", "quantity": 1,
        "tag_ids": [vermouth_tag["id"]],
    })
    r = client.get("/api/cocktails/makeable")
    names = [c["name"] for c in r.json()]
    assert "Martini" in names
