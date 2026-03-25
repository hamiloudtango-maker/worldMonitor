"""Market domain — 17 RPCs. Finnhub, CoinGecko, Yahoo, seed data."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/market/v1", tags=["market"])

_now = lambda: datetime.now(timezone.utc).isoformat()
_stub = lambda note: {"note": note, "fetched_at": _now()}

COINGECKO_URL = "https://api.coingecko.com/api/v3"


@router.get("/list-market-quotes")
async def list_market_quotes():
    return {**_stub("Requires Finnhub API key"), "quotes": []}


@router.get("/list-crypto-quotes")
async def list_crypto_quotes(per_page: int = Query(20)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_URL}/coins/markets",
                params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": per_page, "page": 1},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            data = resp.json()
            return {"quotes": data, "total": len(data), "fetched_at": _now()}
    except Exception as e:
        return {"quotes": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-commodity-quotes")
async def list_commodity_quotes():
    return {**_stub("Requires commodity data source"), "quotes": []}


@router.get("/get-sector-summary")
async def get_sector_summary():
    return {**_stub("Requires Finnhub API key"), "sectors": []}


@router.get("/list-stablecoin-markets")
async def list_stablecoin_markets():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_URL}/coins/markets",
                params={"vs_currency": "usd", "category": "stablecoins", "per_page": 10},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            return {"stablecoins": resp.json(), "fetched_at": _now()}
    except Exception as e:
        return {"stablecoins": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-etf-flows")
async def list_etf_flows():
    return {**_stub("Requires seed job (ETF flow data)"), "flows": []}


@router.get("/get-country-stock-index")
async def get_country_stock_index(country: str = Query("US")):
    return {**_stub("Requires market data source"), "country": country}


@router.get("/list-gulf-quotes")
async def list_gulf_quotes():
    return {**_stub("Requires seed job (Gulf market data)"), "quotes": []}


@router.get("/analyze-stock")
async def analyze_stock(symbol: str = Query("AAPL")):
    return {**_stub("Requires Finnhub API key + LLM"), "symbol": symbol}


@router.get("/get-stock-analysis-history")
async def get_stock_analysis_history(symbol: str = Query("AAPL")):
    return {**_stub("Requires seed job"), "symbol": symbol, "history": []}


@router.post("/backtest-stock")
async def backtest_stock(symbol: str = Query("AAPL"), strategy: str = Query("ma_crossover")):
    return {**_stub("Requires market data source"), "symbol": symbol, "strategy": strategy}


@router.get("/list-stored-stock-backtests")
async def list_stored_stock_backtests():
    return {**_stub("Requires seed job"), "backtests": []}


@router.get("/list-crypto-sectors")
async def list_crypto_sectors():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{COINGECKO_URL}/coins/categories", headers={"User-Agent": "WorldMonitor/2.0"})
            resp.raise_for_status()
            cats = resp.json()[:20]
            return {"sectors": [{"name": c.get("name"), "market_cap": c.get("market_cap"), "volume_24h": c.get("volume_24h")} for c in cats], "fetched_at": _now()}
    except Exception as e:
        return {"sectors": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-defi-tokens")
async def list_defi_tokens(per_page: int = Query(20)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_URL}/coins/markets",
                params={"vs_currency": "usd", "category": "decentralized-finance-defi", "per_page": per_page},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            return {"tokens": resp.json(), "fetched_at": _now()}
    except Exception as e:
        return {"tokens": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-ai-tokens")
async def list_ai_tokens(per_page: int = Query(20)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_URL}/coins/markets",
                params={"vs_currency": "usd", "category": "artificial-intelligence", "per_page": per_page},
                headers={"User-Agent": "WorldMonitor/2.0"},
            )
            resp.raise_for_status()
            return {"tokens": resp.json(), "fetched_at": _now()}
    except Exception as e:
        return {"tokens": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-other-tokens")
async def list_other_tokens(per_page: int = Query(20)):
    return {**_stub("Requires seed job"), "tokens": []}


@router.get("/get-fear-greed-index")
async def get_fear_greed_index():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://api.alternative.me/fng/", headers={"User-Agent": "WorldMonitor/2.0"})
            resp.raise_for_status()
            data = resp.json().get("data", [{}])[0]
            return {"value": int(data.get("value", 0)), "classification": data.get("value_classification", ""), "timestamp": data.get("timestamp", ""), "fetched_at": _now()}
    except Exception as e:
        return {"value": 0, "error": str(e)[:80], "fetched_at": _now()}
