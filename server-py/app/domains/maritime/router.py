"""
Maritime domain — vessel tracking and navigational warnings.
RPCs: ListNavigationalWarnings (NGA API)
"""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/maritime/v1", tags=["maritime"])

NGA_WARNINGS_URL = "https://msi.nga.mil/api/publications/broadcast-warn"


@router.get("/list-navigational-warnings")
async def list_navigational_warnings(
    page_size: int = Query(20, ge=1, le=100),
    area: str = Query(""),
):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {"output": "json", "status": "A"}
            if area:
                params["navArea"] = area
            resp = await client.get(NGA_WARNINGS_URL, params=params,
                                     headers={"User-Agent": "WorldMonitor/2.0"})
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"warnings": [], "error": str(e), "fetched_at": datetime.now(timezone.utc).isoformat()}

    warnings = []
    for w in (data.get("broadcast-warn", []) or [])[:page_size]:
        warnings.append({
            "id": w.get("msgNumber", ""),
            "area": w.get("navArea", ""),
            "year": w.get("msgYear"),
            "text": w.get("text", "")[:200],
            "status": w.get("status", ""),
            "authority": w.get("authority", ""),
            "issue_date": w.get("issueDate", ""),
        })

    return {
        "warnings": warnings,
        "total_count": len(warnings),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
