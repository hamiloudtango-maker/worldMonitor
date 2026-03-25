"""
Conflict domain — HDX HAPI humanitarian data.
RPCs: GetHumanitarianSummary
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/conflict/v1", tags=["conflict"])

HAPI_URL = "https://hapi.humdata.org/api/v2/coordination-context/conflict-events"


@router.get("/get-humanitarian-summary")
async def get_humanitarian_summary(country_code: str = Query(..., min_length=2, max_length=3)):
    # Convert ISO-2 to ISO-3 for HAPI
    iso3 = country_code.upper()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                HAPI_URL,
                params={"output_format": "json", "limit": 1000, "location_code": iso3},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"error": str(e), "country_code": country_code}

    results = data.get("data", [])
    total_events = sum(r.get("events", 0) or 0 for r in results)
    total_fatalities = sum(r.get("fatalities", 0) or 0 for r in results)

    return {
        "country_code": country_code,
        "conflict_events_total": total_events,
        "conflict_fatalities": total_fatalities,
        "data_points": len(results),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
