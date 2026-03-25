"""Prediction markets — Polymarket data."""

from fastapi import APIRouter, Query

from app.domains._shared.http import fetch_json, now_iso

router = APIRouter(prefix="/prediction/v1", tags=["prediction"])

POLYMARKET_URL = "https://gamma-api.polymarket.com/markets"


@router.get("/list-prediction-markets")
async def list_prediction_markets(page_size: int = Query(20, ge=1, le=100)):
    data = await fetch_json(POLYMARKET_URL, params={"limit": page_size, "active": True, "closed": False})

    markets = [
        {
            "id": m.get("id", ""),
            "title": m.get("question", ""),
            "yes_price": m.get("outcomePrices", [0])[0] if m.get("outcomePrices") else 0,
            "volume": m.get("volume", 0),
            "liquidity": m.get("liquidity", 0),
            "url": f"https://polymarket.com/event/{m.get('slug', '')}",
            "closes_at": m.get("endDate", ""),
            "category": m.get("category", ""),
            "source": "polymarket",
        }
        for m in data[:page_size]
    ]

    return {"markets": markets, "total_count": len(markets), "fetched_at": now_iso()}
