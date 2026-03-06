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


def test_update_user(client):
    r = client.post("/api/users", json={"name": "Eve"})
    user_id = r.json()["id"]
    r = client.patch(f"/api/users/{user_id}", json={"display_name": "Evelyn"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "Evelyn"


def test_update_user_not_found(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = client.patch(f"/api/users/{fake_id}", json={"display_name": "Ghost"})
    assert r.status_code == 404


def test_delete_user(client):
    r = client.post("/api/users", json={"name": "Temp"})
    user_id = r.json()["id"]
    r = client.delete(f"/api/users/{user_id}")
    assert r.status_code == 204
    r = client.get("/api/users")
    names = [u["name"] for u in r.json()]
    assert "Temp" not in names


def test_delete_user_not_found(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    r = client.delete(f"/api/users/{fake_id}")
    assert r.status_code == 404


def test_user_has_display_name_and_image(client):
    r = client.post("/api/users", json={"name": "Frank"})
    data = r.json()
    assert "display_name" in data
    assert "image_path" in data
    assert data["display_name"] is None
    assert data["image_path"] is None
