"""Climate — current weather from Open-Meteo for sample cities."""

import asyncio

from fastapi import APIRouter, Query

from app.domains._shared.http import fetch_json, now_iso

router = APIRouter(prefix="/climate/v1", tags=["climate"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

CITIES = [
    ("Paris", 48.85, 2.35),
    ("Tokyo", 35.68, 139.69),
    ("New York", 40.71, -74.01),
    ("São Paulo", -23.55, -46.63),
    ("Lagos", 6.45, 3.39),
    ("Mumbai", 19.08, 72.88),
]


@router.get("/list-climate-anomalies")
async def list_climate_anomalies(page_size: int = Query(20, ge=1, le=100)):
    async def fetch_city(name: str, lat: float, lon: float) -> dict | None:
        try:
            data = await fetch_json(
                OPEN_METEO_URL,
                params={"latitude": lat, "longitude": lon, "current": "temperature_2m,relative_humidity_2m,wind_speed_10m"},
            )
            current = data.get("current", {})
            return {
                "location": name, "lat": lat, "lon": lon,
                "temperature_c": current.get("temperature_2m"),
                "humidity_pct": current.get("relative_humidity_2m"),
                "wind_speed_kmh": current.get("wind_speed_10m"),
                "observed_at": current.get("time", ""),
            }
        except Exception:
            return None

    results = await asyncio.gather(*[fetch_city(n, la, lo) for n, la, lo in CITIES])
    anomalies = [r for r in results if r is not None]

    return {"anomalies": anomalies[:page_size], "fetched_at": now_iso()}
