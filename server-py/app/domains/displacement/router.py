"""
Displacement domain — refugee/displacement data from UNHCR.
RPCs: GetDisplacementSummary
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/displacement/v1", tags=["displacement"])

UNHCR_URL = "https://api.unhcr.org/population/v1/population/"


@router.get("/get-displacement-summary")
async def get_displacement_summary(
    year: int = Query(2023, ge=2000, le=2030),
    country_limit: int = Query(10, ge=1, le=50),
):
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                UNHCR_URL,
                params={"year": year, "limit": 100, "page": 1, "coo_all": "true", "coa_all": "true"},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"error": str(e), "fetched_at": datetime.now(timezone.utc).isoformat()}

    items = data.get("items", [])
    countries: dict[str, dict] = {}
    total_refugees = 0

    for item in items:
        coa = item.get("coa_name", "Unknown")
        refugees = item.get("refugees", 0) or 0
        asylum = item.get("asylum_seekers", 0) or 0
        total_refugees += refugees
        if coa not in countries:
            countries[coa] = {"name": coa, "refugees": 0, "asylum_seekers": 0}
        countries[coa]["refugees"] += refugees
        countries[coa]["asylum_seekers"] += asylum

    top = sorted(countries.values(), key=lambda c: c["refugees"], reverse=True)[:country_limit]

    return {
        "year": year,
        "total_refugees": total_refugees,
        "countries": top,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
