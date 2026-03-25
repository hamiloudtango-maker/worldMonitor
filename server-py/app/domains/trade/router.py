"""Trade domain — Comtrade live API."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/trade/v1", tags=["trade"])

_now = lambda: datetime.now(timezone.utc).isoformat()


@router.get("/list-comtrade-flows")
async def list_comtrade_flows(
    reporter: str = Query("842"), partner: str = Query("156"),
    commodity: str = Query("TOTAL"), page_size: int = Query(20),
):
    # Comtrade v2 API is public
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://comtradeapi.un.org/public/v1/preview/C/A/HS",
                params={"reporterCode": reporter, "partnerCode": partner, "cmdCode": commodity, "flowCode": "M,X", "period": "2023"},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            flows = [{"period": r.get("period"), "flow": r.get("flowDesc"), "value": r.get("primaryValue"), "partner": r.get("partnerDesc")} for r in data.get("data", [])[:page_size]]
            return {"flows": flows, "total": len(flows), "fetched_at": _now()}
    except Exception as e:
        return {"flows": [], "error": str(e)[:80], "fetched_at": _now()}
