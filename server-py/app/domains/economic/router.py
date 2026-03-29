"""Economic domain — FRED and World Bank live APIs."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

from app.config import settings

router = APIRouter(prefix="/economic/v1", tags=["economic"])

_now = lambda: datetime.now(timezone.utc).isoformat()

WORLDBANK_URL = "https://api.worldbank.org/v2"


FRED_TO_YAHOO = {"DGS10": "^TNX", "DGS5": "^FVX", "DGS30": "^TYX", "DGS2": "2YY=F", "DTB3": "^IRX"}
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart"


@router.get("/get-fred-series")
async def get_fred_series(series_id: str = Query("DGS10"), limit: int = Query(30)):
    # Try FRED first if API key available
    fred_key = getattr(settings, "fred_api_key", None)
    if fred_key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://api.stlouisfed.org/fred/series/observations",
                    params={"series_id": series_id, "api_key": fred_key, "file_type": "json", "limit": limit, "sort_order": "desc"},
                )
                resp.raise_for_status()
                obs = resp.json().get("observations", [])
                return {"series_id": series_id, "observations": obs[:limit], "fetched_at": _now()}
        except Exception:
            pass

    # Fallback: Yahoo Finance for US treasury yields
    yahoo_sym = FRED_TO_YAHOO.get(series_id)
    if not yahoo_sym:
        return {"series_id": series_id, "observations": [], "note": f"No Yahoo fallback for {series_id}", "fetched_at": _now()}
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(
                f"{YAHOO_CHART}/{yahoo_sym}",
                params={"interval": "1d", "range": "1mo"},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            result = resp.json()["chart"]["result"][0]
            timestamps = result.get("timestamp", [])
            closes = result["indicators"]["quote"][0].get("close", [])
            from datetime import datetime as dt
            obs = [
                {"date": dt.utcfromtimestamp(t).strftime("%Y-%m-%d"), "value": str(round(v, 2)) if v else "."}
                for t, v in zip(timestamps, closes) if v is not None
            ]
            return {"series_id": series_id, "observations": obs[-limit:], "fetched_at": _now()}
    except Exception as e:
        return {"series_id": series_id, "error": str(e)[:80], "observations": [], "fetched_at": _now()}


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
