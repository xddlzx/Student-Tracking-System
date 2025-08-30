def test_health(client):
    r = client.get("/healthz")
    assert r.status_code == 200
