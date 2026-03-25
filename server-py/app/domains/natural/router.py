"""Natural events — storms, fires, volcanoes from NASA EONET."""

from fastapi import APIRouter, Query

from app.domains._shared.http import fetch_json, now_iso

router = APIRouter(prefix="/natural/v1", tags=["natural"])

EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"


@router.get("/list-natural-events")
async def list_natural_events(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
):
    data = await fetch_json(EONET_URL, params={"status": "open", "limit": limit, "days": days})

    events = []
    for e in data.get("events", []):
        geometries = e.get("geometry", [])
        lat, lon, event_date, mag, mag_unit = 0.0, 0.0, "", 0.0, ""
        if geometries:
            latest = geometries[-1]
            coords = latest.get("coordinates", [0, 0])
            lon, lat = coords[0], coords[1]
            event_date = latest.get("date", "")
            mag = latest.get("magnitudeValue") or 0
            mag_unit = latest.get("magnitudeUnit", "")

        categories = e.get("categories", [])
        sources = e.get("sources", [])

        events.append({
            "id": e.get("id", ""),
            "title": e.get("title", ""),
            "category": categories[0].get("id", "") if categories else "",
            "category_title": categories[0].get("title", "") if categories else "",
            "lat": lat, "lon": lon,
            "date": event_date,
            "magnitude": mag,
            "magnitude_unit": mag_unit,
            "source_url": sources[0].get("url", "") if sources else "",
            "closed": e.get("closed") is not None,
        })

    return {"events": events, "total_count": len(events), "fetched_at": now_iso()}
