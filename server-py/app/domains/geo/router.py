"""
Geo Layers API — unified endpoint for all geographic data sources.

GET /api/geo/v1/catalog         → list all layers with metadata
GET /api/geo/v1/layers/{id}     → GeoJSON features + freshness metadata
POST /api/geo/v1/layers/{id}/refresh  → force re-fetch
"""

import logging

from fastapi import APIRouter, HTTPException

from app.domains.geo.registry import LAYERS
from app.domains.geo import cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/geo/v1", tags=["geo"])


@router.get("/catalog")
async def catalog():
    """List all available layers with metadata (no features)."""
    items = []
    for layer in LAYERS.values():
        age = cache.age_hours(layer.id)
        cached = cache.read(layer.id)
        items.append({
            "id": layer.id,
            "name": layer.name,
            "category": layer.category,
            "icon": layer.icon,
            "ttl_hours": layer.ttl_hours,
            "fetched_at": cached.get("fetched_at") if cached else None,
            "age_hours": round(age, 1) if age is not None else None,
            "stale": not cache.is_fresh(layer.id, layer.ttl_hours),
            "feature_count": cached.get("feature_count", 0) if cached else 0,
        })
    return {"layers": items, "total": len(items)}


@router.get("/layers/{layer_id}")
async def get_layer(layer_id: str):
    """Get GeoJSON features for a layer. Uses cache if fresh, fetches otherwise."""
    layer = LAYERS.get(layer_id)
    if not layer:
        raise HTTPException(404, f"Layer '{layer_id}' not found. Use /catalog to list available layers.")

    # Serve from cache if fresh
    if cache.is_fresh(layer_id, layer.ttl_hours):
        cached = cache.read(layer_id)
        if cached:
            return cached

    # Fetch fresh data
    try:
        features = await layer.fetch()
        logger.info(f"Layer '{layer_id}': fetched {len(features)} features")
    except Exception as e:
        logger.warning(f"Layer '{layer_id}' fetch failed: {e}, serving stale cache")
        cached = cache.read(layer_id)
        if cached:
            cached["stale"] = True
            return cached
        raise HTTPException(502, f"Failed to fetch '{layer_id}': {e}")

    return cache.write(layer_id, features, {
        "name": layer.name,
        "category": layer.category,
        "icon": layer.icon,
        "ttl_hours": layer.ttl_hours,
        "stale": False,
    })


@router.post("/layers/{layer_id}/refresh")
async def refresh_layer(layer_id: str):
    """Force re-fetch a layer, ignoring cache."""
    layer = LAYERS.get(layer_id)
    if not layer:
        raise HTTPException(404, f"Layer '{layer_id}' not found.")

    features = await layer.fetch()
    result = cache.write(layer_id, features, {
        "name": layer.name,
        "category": layer.category,
        "icon": layer.icon,
        "ttl_hours": layer.ttl_hours,
        "stale": False,
    })
    return {"refreshed": True, "feature_count": len(features), "layer": layer_id}
