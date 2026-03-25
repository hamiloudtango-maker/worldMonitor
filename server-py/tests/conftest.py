"""Shared test fixtures."""

import asyncio

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///./test.db"

engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
test_session = async_sessionmaker(engine, expire_on_commit=False)


async def override_get_db():
    async with test_session() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def authed_client(client: AsyncClient):
    """Client with a registered user and auth token."""
    resp = await client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "testpass123",
        "org_name": "Test Org",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    yield client
