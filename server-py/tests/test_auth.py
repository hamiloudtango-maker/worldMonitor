"""Tests for auth endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    resp = await client.post("/api/auth/register", json={
        "email": "new@test.com", "password": "pass1234", "org_name": "My Org",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "dup@test.com", "password": "pass1234", "org_name": "Org1",
    })
    resp = await client.post("/api/auth/register", json={
        "email": "dup@test.com", "password": "pass1234", "org_name": "Org2",
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "login@test.com", "password": "pass1234", "org_name": "Org",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "login@test.com", "password": "pass1234",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/auth/register", json={
        "email": "wrong@test.com", "password": "pass1234", "org_name": "Org",
    })
    resp = await client.post("/api/auth/login", json={
        "email": "wrong@test.com", "password": "wrongpass",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me(authed_client: AsyncClient):
    resp = await authed_client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["role"] == "owner"
    assert data["org_name"] == "Test Org"


@pytest.mark.asyncio
async def test_me_no_auth(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    reg = await client.post("/api/auth/register", json={
        "email": "refresh@test.com", "password": "pass1234", "org_name": "Org",
    })
    refresh_token = reg.json()["refresh_token"]
    resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()
