"""Tests for live domain endpoints — verify they return real data."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_earthquakes(client: AsyncClient):
    resp = await client.get("/api/seismology/v1/list-earthquakes?page_size=5")
    assert resp.status_code == 200
    data = resp.json()
    assert "earthquakes" in data
    assert data["total_count"] >= 0
    if data["earthquakes"]:
        q = data["earthquakes"][0]
        assert "magnitude" in q
        assert "place" in q


@pytest.mark.asyncio
async def test_natural_events(client: AsyncClient):
    resp = await client.get("/api/natural/v1/list-natural-events?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data


@pytest.mark.asyncio
async def test_climate(client: AsyncClient):
    resp = await client.get("/api/climate/v1/list-climate-anomalies")
    assert resp.status_code == 200
    data = resp.json()
    assert "anomalies" in data
    assert len(data["anomalies"]) > 0
    assert "temperature_c" in data["anomalies"][0]


@pytest.mark.asyncio
async def test_prediction_markets(client: AsyncClient):
    resp = await client.get("/api/prediction/v1/list-prediction-markets?page_size=3")
    assert resp.status_code == 200
    data = resp.json()
    assert "markets" in data


@pytest.mark.asyncio
async def test_fear_greed(client: AsyncClient):
    resp = await client.get("/api/market/v1/get-fear-greed-index")
    assert resp.status_code == 200
    data = resp.json()
    assert "value" in data
    assert 0 <= data["value"] <= 100


@pytest.mark.asyncio
async def test_hackernews(client: AsyncClient):
    resp = await client.get("/api/research/v1/list-hackernews-items?page_size=3")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    if data["items"]:
        assert "title" in data["items"][0]
        assert "score" in data["items"][0]


@pytest.mark.asyncio
async def test_supply_chain_chokepoints(client: AsyncClient):
    resp = await client.get("/api/supply-chain/v1/get-chokepoint-status")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["chokepoints"]) == 13


@pytest.mark.asyncio
async def test_supply_chain_minerals(client: AsyncClient):
    resp = await client.get("/api/supply-chain/v1/get-critical-minerals")
    assert resp.status_code == 200
    assert len(resp.json()["minerals"]) == 5
