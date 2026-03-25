"""Tests for dashboard CRUD."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_dashboard(authed_client: AsyncClient):
    resp = await authed_client.post("/api/dashboards", json={"name": "Test Dashboard"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Dashboard"
    assert data["slug"] == "test-dashboard"
    assert data["is_default"] is True  # first dashboard
    assert data["panels"] == []


@pytest.mark.asyncio
async def test_list_dashboards(authed_client: AsyncClient):
    await authed_client.post("/api/dashboards", json={"name": "Dash 1"})
    await authed_client.post("/api/dashboards", json={"name": "Dash 2"})
    resp = await authed_client.get("/api/dashboards")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@pytest.mark.asyncio
async def test_add_panel(authed_client: AsyncClient):
    dash = (await authed_client.post("/api/dashboards", json={"name": "D"})).json()
    resp = await authed_client.post(f"/api/dashboards/{dash['id']}/panels", json={
        "panel_type": "hardcoded",
        "hardcoded_key": "map",
        "config": {"title": "Map"},
        "position": {"x": 0, "y": 0, "w": 12, "h": 6},
    })
    assert resp.status_code == 201
    panel = resp.json()
    assert panel["panel_type"] == "hardcoded"
    assert panel["position"]["w"] == 12


@pytest.mark.asyncio
async def test_update_layout(authed_client: AsyncClient):
    dash = (await authed_client.post("/api/dashboards", json={"name": "D"})).json()
    new_layout = [{"id": "fake", "x": 1, "y": 2, "w": 3, "h": 4}]
    resp = await authed_client.put(f"/api/dashboards/{dash['id']}", json={"layout": new_layout})
    assert resp.status_code == 200
    assert resp.json()["layout"] == new_layout


@pytest.mark.asyncio
async def test_delete_dashboard(authed_client: AsyncClient):
    dash = (await authed_client.post("/api/dashboards", json={"name": "Del"})).json()
    resp = await authed_client.delete(f"/api/dashboards/{dash['id']}")
    assert resp.status_code == 204
    resp = await authed_client.get("/api/dashboards")
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_clone_dashboard(authed_client: AsyncClient):
    dash = (await authed_client.post("/api/dashboards", json={"name": "Original"})).json()
    await authed_client.post(f"/api/dashboards/{dash['id']}/panels", json={
        "panel_type": "hardcoded", "hardcoded_key": "map",
        "config": {}, "position": {"x": 0, "y": 0, "w": 6, "h": 3},
    })
    resp = await authed_client.post(f"/api/dashboards/{dash['id']}/clone")
    assert resp.status_code == 200
    clone = resp.json()
    assert clone["name"] == "Original (copy)"
    assert len(clone["panels"]) == 1


@pytest.mark.asyncio
async def test_dashboard_isolation(client: AsyncClient):
    # User A
    r1 = await client.post("/api/auth/register", json={"email": "a@test.com", "password": "p", "org_name": "A"})
    token_a = r1.json()["access_token"]
    await client.post("/api/dashboards", json={"name": "A's dash"}, headers={"Authorization": f"Bearer {token_a}"})

    # User B
    r2 = await client.post("/api/auth/register", json={"email": "b@test.com", "password": "p", "org_name": "B"})
    token_b = r2.json()["access_token"]

    resp = await client.get("/api/dashboards", headers={"Authorization": f"Bearer {token_b}"})
    assert len(resp.json()) == 0  # B can't see A's dashboards
