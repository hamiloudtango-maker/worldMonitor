"""Infrastructure domain — bootstrap data and reverse geocoding."""

from datetime import datetime, timezone

from fastapi import APIRouter, Query

router = APIRouter(prefix="/infrastructure/v1", tags=["infrastructure"])

_now = lambda: datetime.now(timezone.utc).isoformat()


@router.get("/reverse-geocode")
async def reverse_geocode(lat: float = Query(48.85), lon: float = Query(2.35)):
    return {"lat": lat, "lon": lon, "note": "Requires geocoding service", "fetched_at": _now()}


@router.get("/get-bootstrap-data")
async def get_bootstrap_data(keys: str = Query("")):
    return {"keys": keys.split(",") if keys else [], "data": {}, "fetched_at": _now()}
