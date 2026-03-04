def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_user(client):
    r = client.post("/api/users", json={"name": "Alice"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Alice"
    assert "id" in data


def test_list_users(client):
    client.post("/api/users", json={"name": "Bob"})
    r = client.get("/api/users")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_select_user(client):
    r = client.post("/api/users", json={"name": "Charlie"})
    user_id = r.json()["id"]
    r = client.post(f"/api/users/{user_id}/select")
    assert r.status_code == 200
    assert "cellarbar_user" in r.cookies


def test_get_me_with_cookie(client):
    r = client.post("/api/users", json={"name": "Diana"})
    user_id = r.json()["id"]
    client.post(f"/api/users/{user_id}/select")
    r = client.get("/api/users/me")
    assert r.status_code == 200
    assert r.json()["name"] == "Diana"


def test_get_me_without_cookie(client):
    r = client.get("/api/users/me")
    assert r.status_code == 401
