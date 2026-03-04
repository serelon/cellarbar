import pytest


@pytest.fixture
def user_and_bottle(client):
    u = client.post("/api/users", json={"name": "Taster"})
    user_id = u.json()["id"]
    client.post(f"/api/users/{user_id}/select")
    b = client.post("/api/bottles", json={"name": "Tasting Wine", "type": "wine", "quantity": 1})
    bottle_id = b.json()["id"]
    return user_id, bottle_id


def test_create_tasting(client, user_and_bottle):
    user_id, bottle_id = user_and_bottle
    r = client.post("/api/tastings", json={
        "bottle_id": bottle_id,
        "rating": 8,
        "notes": "Excellent, dark fruit and tannins",
        "food_pairing": "Grilled lamb",
        "pairing_rating": 9,
        "would_drink_again": True,
    })
    assert r.status_code == 201
    assert r.json()["rating"] == 8


def test_list_tastings_by_bottle(client, user_and_bottle):
    user_id, bottle_id = user_and_bottle
    client.post("/api/tastings", json={"bottle_id": bottle_id, "rating": 7})
    r = client.get(f"/api/tastings?bottle_id={bottle_id}")
    assert len(r.json()) >= 1


def test_tasting_requires_auth(client):
    b = client.post("/api/bottles", json={"name": "No Auth Wine", "type": "wine", "quantity": 1})
    client.cookies.clear()
    r = client.post("/api/tastings", json={"bottle_id": b.json()["id"], "rating": 5})
    assert r.status_code == 401
