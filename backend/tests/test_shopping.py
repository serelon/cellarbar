def test_add_shopping_item(client):
    r = client.post("/api/shopping", json={"name": "Campari"})
    assert r.status_code == 201
    assert r.json()["source"] == "manual"
    assert r.json()["is_bought"] == False


def test_add_scanned_item(client):
    r = client.post("/api/shopping", json={"name": "Barolo", "barcode": "1234567890", "source": "scan"})
    assert r.status_code == 201
    assert r.json()["barcode"] == "1234567890"
    assert r.json()["source"] == "scan"


def test_toggle_bought(client):
    r = client.post("/api/shopping", json={"name": "Gin"})
    item_id = r.json()["id"]
    r = client.patch(f"/api/shopping/{item_id}", json={"is_bought": True})
    assert r.json()["is_bought"] == True


def test_list_hides_bought(client):
    client.post("/api/shopping", json={"name": "Visible"})
    r2 = client.post("/api/shopping", json={"name": "Hidden"})
    client.patch(f"/api/shopping/{r2.json()['id']}", json={"is_bought": True})
    r = client.get("/api/shopping")
    names = [i["name"] for i in r.json()]
    assert "Visible" in names
    assert "Hidden" not in names


def test_clear_bought(client):
    r = client.post("/api/shopping", json={"name": "To Clear"})
    client.patch(f"/api/shopping/{r.json()['id']}", json={"is_bought": True})
    client.delete("/api/shopping")
    r = client.get("/api/shopping?show_bought=true")
    names = [i["name"] for i in r.json()]
    assert "To Clear" not in names
