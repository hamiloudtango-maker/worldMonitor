"""Seismology — earthquake data from USGS."""

from fastapi import APIRouter, Query

from app.domains._shared.http import fetch_json, now_iso

router = APIRouter(prefix="/seismology/v1", tags=["seismology"])

USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson"


@router.get("/list-earthquakes")
async def list_earthquakes(
    min_magnitude: float = Query(0, ge=0),
    page_size: int = Query(500, ge=1, le=1000),
):
    data = await fetch_json(USGS_URL)

    earthquakes = []
    for f in data.get("features", []):
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [0, 0, 0])
        mag = props.get("mag", 0) or 0
        if mag < min_magnitude:
            continue
        earthquakes.append({
            "id": f.get("id", ""),
            "place": props.get("place", ""),
            "magnitude": mag,
            "depth_km": coords[2] if len(coords) > 2 else 0,
            "location": {"latitude": coords[1], "longitude": coords[0]},
            "occurred_at": props.get("time", 0),
            "source_url": props.get("url", ""),
            "alert": props.get("alert"),
            "tsunami": props.get("tsunami", 0),
        })

    return {"earthquakes": earthquakes[:page_size], "total_count": len(earthquakes), "fetched_at": now_iso()}
