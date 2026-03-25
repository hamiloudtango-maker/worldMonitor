"""
Imagery domain — satellite imagery search via Element84 STAC API.
RPC: SearchImagery
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/imagery/v1", tags=["imagery"])

STAC_URL = "https://earth-search.aws.element84.com/v1/search"


@router.post("/search-imagery")
async def search_imagery(
    latitude: float = Query(48.85),
    longitude: float = Query(2.35),
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(10, ge=1, le=50),
):
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
    end = now.strftime("%Y-%m-%dT23:59:59Z")

    # Bounding box: ~50km around point
    delta = 0.5
    bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta]

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                STAC_URL,
                json={
                    "collections": ["sentinel-2-l2a"],
                    "bbox": bbox,
                    "datetime": f"{start}/{end}",
                    "limit": limit,
                },
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"scenes": [], "total_results": 0, "error": str(e)}

    scenes = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        assets = feature.get("assets", {})
        thumbnail = assets.get("thumbnail", {}).get("href", "")

        scenes.append({
            "id": feature.get("id", ""),
            "satellite": "Sentinel-2",
            "datetime": props.get("datetime", ""),
            "cloud_cover": props.get("eo:cloud_cover"),
            "resolution": 10,
            "preview_url": thumbnail,
            "geometry": feature.get("geometry"),
        })

    return {
        "scenes": scenes,
        "total_results": data.get("numberMatched", len(scenes)),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
