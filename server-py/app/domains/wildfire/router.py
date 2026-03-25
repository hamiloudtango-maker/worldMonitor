"""Wildfire — fire detections from NASA FIRMS (requires API key)."""

import csv
import io

from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings
from app.domains._shared.http import fetch_text, now_iso

router = APIRouter(prefix="/wildfire/v1", tags=["wildfire"])

FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


@router.get("/list-fire-detections")
async def list_fire_detections(
    page_size: int = Query(200, ge=1, le=1000),
    days: int = Query(1, ge=1, le=10),
):
    firms_key = getattr(settings, "nasa_firms_api_key", None)
    if not firms_key:
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "NASA FIRMS API key not configured")

    raw = await fetch_text(f"{FIRMS_URL}/{firms_key}/VIIRS_SNPP_NRT/world/{days}", timeout=30)

    reader = csv.DictReader(io.StringIO(raw))
    fires = []
    for row in reader:
        if len(fires) >= page_size:
            break
        try:
            fires.append({
                "id": f"{row.get('latitude', '')},{row.get('longitude', '')}",
                "location": {
                    "latitude": float(row.get("latitude", 0)),
                    "longitude": float(row.get("longitude", 0)),
                },
                "brightness": float(row.get("bright_ti4", 0)),
                "frp": float(row.get("frp", 0)),
                "confidence": row.get("confidence", "nominal"),
                "satellite": row.get("satellite", ""),
                "detected_at": f"{row.get('acq_date', '')}T{row.get('acq_time', '00:00')}Z",
                "day_night": row.get("daynight", ""),
            })
        except (ValueError, KeyError):
            continue

    return {"fires": fires, "total_count": len(fires), "fetched_at": now_iso()}
