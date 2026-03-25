"""Cyber threats — C2 server intelligence from Feodo Tracker."""

from fastapi import APIRouter, Query

from app.domains._shared.http import fetch_json, now_iso

router = APIRouter(prefix="/cyber/v1", tags=["cyber"])

FEODO_URL = "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json"


@router.get("/list-cyber-threats")
async def list_cyber_threats(page_size: int = Query(50, ge=1, le=200)):
    data = await fetch_json(FEODO_URL)

    threats = [
        {
            "id": entry.get("ip_address", ""),
            "type": "c2_server",
            "ip": entry.get("ip_address", ""),
            "port": entry.get("port"),
            "malware": entry.get("malware", ""),
            "status": entry.get("status", ""),
            "first_seen": entry.get("first_seen", ""),
            "last_online": entry.get("last_online", ""),
            "country": entry.get("country", ""),
        }
        for entry in data[:page_size]
    ]

    return {"threats": threats, "total_count": len(threats), "fetched_at": now_iso()}
