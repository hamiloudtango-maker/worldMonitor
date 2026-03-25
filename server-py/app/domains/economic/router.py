"""Economic domain — FRED and World Bank live APIs."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

from app.config import settings

router = APIRouter(prefix="/economic/v1", tags=["economic"])

_now = lambda: datetime.now(timezone.utc).isoformat()

WORLDBANK_URL = "https://api.worldbank.org/v2"


@router.get("/get-fred-series")
async def get_fred_series(series_id: str = Query("DGS10"), limit: int = Query(30)):
    fred_key = getattr(settings, "fred_api_key", None)
    if not fred_key:
        return {"series_id": series_id, "observations": [], "note": "Requires FRED_API_KEY", "fetched_at": _now()}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.stlouisfed.org/fred/series/observations",
                params={"series_id": series_id, "api_key": fred_key, "file_type": "json", "limit": limit, "sort_order": "desc"},
            )
            resp.raise_for_status()
            obs = resp.json().get("observations", [])
            return {"series_id": series_id, "observations": obs[:limit], "fetched_at": _now()}
    except Exception as e:
        return {"series_id": series_id, "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-world-bank-indicators")
async def list_world_bank_indicators(
    country: str = Query("US"), indicator: str = Query("NY.GDP.MKTP.CD"), per_page: int = Query(10),
):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{WORLDBANK_URL}/country/{country}/indicator/{indicator}",
                params={"format": "json", "per_page": per_page},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            entries = data[1] if isinstance(data, list) and len(data) > 1 else []
            return {"country": country, "indicator": indicator, "data": entries, "fetched_at": _now()}
    except Exception as e:
        return {"error": str(e)[:80], "fetched_at": _now()}
