"""
Supply chain domain — chokepoints, critical minerals.
RPCs: GetChokepointStatus, GetCriticalMinerals
"""

from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/supply-chain/v1", tags=["supply_chain"])

# 13 canonical chokepoints
CHOKEPOINTS = [
    {"id": "suez", "name": "Suez Canal", "lat": 30.46, "lon": 32.35},
    {"id": "malacca", "name": "Strait of Malacca", "lat": 2.5, "lon": 101.5},
    {"id": "hormuz", "name": "Strait of Hormuz", "lat": 26.57, "lon": 56.25},
    {"id": "bab_el_mandeb", "name": "Bab el-Mandeb", "lat": 12.6, "lon": 43.3},
    {"id": "panama", "name": "Panama Canal", "lat": 9.08, "lon": -79.68},
    {"id": "gibraltar", "name": "Strait of Gibraltar", "lat": 35.96, "lon": -5.5},
    {"id": "dover", "name": "Strait of Dover", "lat": 51.0, "lon": 1.5},
    {"id": "bosphorus", "name": "Bosphorus", "lat": 41.12, "lon": 29.05},
    {"id": "taiwan", "name": "Taiwan Strait", "lat": 24.0, "lon": 118.5},
    {"id": "lombok", "name": "Lombok Strait", "lat": -8.4, "lon": 115.7},
    {"id": "cape_good_hope", "name": "Cape of Good Hope", "lat": -34.36, "lon": 18.47},
    {"id": "danish_straits", "name": "Danish Straits", "lat": 55.5, "lon": 12.5},
    {"id": "tsugaru", "name": "Tsugaru Strait", "lat": 41.5, "lon": 140.5},
]


@router.get("/get-chokepoint-status")
async def get_chokepoint_status():
    chokepoints = [
        {**cp, "disruption_score": 0, "status": "normal", "active_warnings": 0}
        for cp in CHOKEPOINTS
    ]
    return {
        "chokepoints": chokepoints,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/get-critical-minerals")
async def get_critical_minerals():
    # Hardcoded 2024 data
    minerals = [
        {"mineral": "Lithium", "top_producers": ["Australia", "Chile", "China"], "hhi": 0.31, "risk_rating": "high"},
        {"mineral": "Cobalt", "top_producers": ["DRC", "Indonesia", "Russia"], "hhi": 0.42, "risk_rating": "critical"},
        {"mineral": "Rare Earths", "top_producers": ["China", "Myanmar", "Australia"], "hhi": 0.58, "risk_rating": "critical"},
        {"mineral": "Nickel", "top_producers": ["Indonesia", "Philippines", "Russia"], "hhi": 0.25, "risk_rating": "medium"},
        {"mineral": "Graphite", "top_producers": ["China", "Mozambique", "Madagascar"], "hhi": 0.52, "risk_rating": "high"},
    ]
    return {
        "minerals": minerals,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
