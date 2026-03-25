"""Radiation — measurements from Safecast API."""

from fastapi import APIRouter, Query

from app.domains._shared.http import fetch_json, now_iso

router = APIRouter(prefix="/radiation/v1", tags=["radiation"])

SAFECAST_URL = "https://api.safecast.org/measurements.json"


@router.get("/list-radiation-observations")
async def list_radiation_observations(
    max_items: int = Query(18, ge=1, le=25),
    latitude: float = Query(35.6762),
    longitude: float = Query(139.6503),
):
    data = await fetch_json(
        SAFECAST_URL,
        params={"distance": 1000, "latitude": latitude, "longitude": longitude, "per_page": max_items},
    )

    observations = [
        {
            "id": str(m.get("id", "")),
            "source": "SAFECAST",
            "location_name": m.get("location_name", ""),
            "location": {"latitude": m.get("latitude", 0), "longitude": m.get("longitude", 0)},
            "value": m.get("value", 0),
            "unit": m.get("unit", "cpm"),
            "observed_at": m.get("captured_at", ""),
        }
        for m in data[:max_items]
    ]

    return {"observations": observations, "safecast_count": len(observations), "fetched_at": now_iso()}
