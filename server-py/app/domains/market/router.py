"""Market domain — crypto (CoinGecko), indices/ETF/commodities (Yahoo Finance), FRED rates."""

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

router = APIRouter(prefix="/market/v1", tags=["market"])

_now = lambda: datetime.now(timezone.utc).isoformat()

COINGECKO_URL = "https://api.coingecko.com/api/v3"
YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
UA = {"User-Agent": "WorldMonitor/2.0"}


# ── Yahoo Finance helper ─────────────────────────────────────────

async def _yahoo_one(client: httpx.AsyncClient, sym: str) -> dict | None:
    try:
        resp = await client.get(
            f"{YAHOO_URL}/{sym}",
            params={"interval": "1d", "range": "5d"},
            headers=UA,
        )
        resp.raise_for_status()
        meta = resp.json()["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("chartPreviousClose") or meta.get("previousClose") or price
        change_pct = round((price - prev) / prev * 100, 2) if prev else 0
        return {
            "symbol": sym,
            "name": meta.get("shortName") or meta.get("longName") or sym,
            "price": price,
            "currency": meta.get("currency", "USD"),
            "change_pct": change_pct,
            "exchange": meta.get("exchangeName", ""),
        }
    except Exception:
        return None


async def _yahoo_quotes(symbols: list[str]) -> list[dict]:
    """Fetch latest quotes from Yahoo Finance in parallel."""
    import asyncio
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        tasks = [_yahoo_one(client, sym) for sym in symbols]
        results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]


# ── Crypto (CoinGecko) ───────────────────────────────────────────

@router.get("/list-crypto-quotes")
async def list_crypto_quotes(per_page: int = Query(20)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_URL}/coins/markets",
                params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": per_page, "page": 1},
                headers=UA,
            )
            resp.raise_for_status()
            data = resp.json()
            return {"quotes": data, "total": len(data), "fetched_at": _now()}
    except Exception as e:
        return {"quotes": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-stablecoin-markets")
async def list_stablecoin_markets():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_URL}/coins/markets",
                params={"vs_currency": "usd", "category": "stablecoins", "per_page": 10},
                headers=UA,
            )
            resp.raise_for_status()
            return {"stablecoins": resp.json(), "fetched_at": _now()}
    except Exception as e:
        return {"stablecoins": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/list-crypto-sectors")
async def list_crypto_sectors():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{COINGECKO_URL}/coins/categories", headers=UA)
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
                headers=UA,
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
                headers=UA,
            )
            resp.raise_for_status()
            return {"tokens": resp.json(), "fetched_at": _now()}
    except Exception as e:
        return {"tokens": [], "error": str(e)[:80], "fetched_at": _now()}


@router.get("/get-fear-greed-index")
async def get_fear_greed_index():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://api.alternative.me/fng/", headers=UA)
            resp.raise_for_status()
            data = resp.json().get("data", [{}])[0]
            return {"value": int(data.get("value", 0)), "classification": data.get("value_classification", ""), "timestamp": data.get("timestamp", ""), "fetched_at": _now()}
    except Exception as e:
        return {"value": 0, "error": str(e)[:80], "fetched_at": _now()}


# ── Indices boursiers (Yahoo Finance) ─────────────────────────────

STOCK_INDICES = {
    "US": ["^GSPC", "^DJI", "^IXIC", "^RUT"],
    "EU": ["^STOXX50E", "^GDAXI", "^FCHI", "^FTSE"],
    "ASIA": ["^N225", "^HSI", "000001.SS", "^KS11"],
    "GULF": ["^TASI", "^ADI", "^DFMGI"],
}

GLOBAL_INDICES = [
    # Amériques
    "^GSPC", "^DJI", "^IXIC", "^BVSP", "^MXX", "^GSPTSE", "^MERV",
    # Europe
    "^STOXX50E", "^GDAXI", "^FCHI", "^FTSE", "^IBEX", "^AEX", "^SSMI", "^OMXS30", "WIG20.WA",
    # Asie-Pacifique
    "^N225", "^HSI", "000001.SS", "^KS11", "^BSESN", "^STI", "^JKSE", "^SET.BK", "^TWII", "^AXJO",
    # Moyen-Orient / Afrique
    "^TASI", "^ADI", "^TA125.TA", "^TOP40",
]

GLOBAL_INDEX_REGIONS = {
    "^GSPC": "US", "^DJI": "US", "^IXIC": "US", "^BVSP": "BR", "^MXX": "MX", "^GSPTSE": "CA", "^MERV": "AR",
    "^STOXX50E": "EU", "^GDAXI": "DE", "^FCHI": "FR", "^FTSE": "GB", "^IBEX": "ES", "^AEX": "NL", "^SSMI": "CH", "^OMXS30": "SE", "WIG20.WA": "PL",
    "^N225": "JP", "^HSI": "HK", "000001.SS": "CN", "^KS11": "KR", "^BSESN": "IN", "^STI": "SG", "^JKSE": "ID", "^SET.BK": "TH", "^TWII": "TW", "^AXJO": "AU",
    "^TASI": "SA", "^ADI": "AE", "^TA125.TA": "IL", "^TOP40": "ZA",
}


@router.get("/get-country-stock-index")
async def get_country_stock_index(country: str = Query("US")):
    symbols = STOCK_INDICES.get(country.upper(), STOCK_INDICES["US"])
    quotes = await _yahoo_quotes(symbols)
    return {"country": country, "indices": quotes, "fetched_at": _now()}


@router.get("/list-global-indices")
async def list_global_indices():
    quotes = await _yahoo_quotes(GLOBAL_INDICES)
    for q in quotes:
        q["region"] = GLOBAL_INDEX_REGIONS.get(q["symbol"], "")
    return {"indices": quotes, "fetched_at": _now()}


@router.get("/list-gulf-quotes")
async def list_gulf_quotes():
    symbols = ["^TASI", "^ADI", "^DFMGI", "^QSI", "^KWSE"]  # Saudi, Abu Dhabi, Dubai, Qatar, Kuwait
    quotes = await _yahoo_quotes(symbols)
    return {"quotes": quotes, "fetched_at": _now()}


# ── ETF Flows (top ETFs via Yahoo Finance) ────────────────────────

TOP_ETFS = ["SPY", "QQQ", "IWM", "EEM", "GLD", "TLT", "HYG", "XLE", "XLF", "XLK", "ARKK", "VTI", "BND", "IBIT"]


@router.get("/list-etf-flows")
async def list_etf_flows():
    quotes = await _yahoo_quotes(TOP_ETFS)
    return {"flows": quotes, "fetched_at": _now()}


# ── Commodities (Yahoo Finance) ──────────────────────────────────

COMMODITY_SYMBOLS = ["GC=F", "SI=F", "CL=F", "BZ=F", "NG=F", "HG=F", "ZC=F", "ZW=F", "ZS=F", "CT=F", "KC=F", "SB=F", "PL=F", "PA=F", "ALI=F"]
COMMODITY_NAMES = {"GC=F": "Or", "SI=F": "Argent", "CL=F": "Petrole WTI", "BZ=F": "Brent", "NG=F": "Gaz Naturel", "HG=F": "Cuivre", "ZC=F": "Mais", "ZW=F": "Ble", "ZS=F": "Soja", "CT=F": "Coton", "KC=F": "Cafe", "SB=F": "Sucre", "PL=F": "Platine", "PA=F": "Palladium", "ALI=F": "Aluminium"}


@router.get("/list-commodity-quotes")
async def list_commodity_quotes():
    quotes = await _yahoo_quotes(COMMODITY_SYMBOLS)
    for q in quotes:
        q["name"] = COMMODITY_NAMES.get(q["symbol"], q["name"])
    return {"quotes": quotes, "fetched_at": _now()}


# ── Résumé sectoriel (Yahoo Finance sector ETFs) ─────────────────

SECTOR_ETFS = {
    "XLK": "Technologie", "XLF": "Finance", "XLE": "Energie", "XLV": "Sante",
    "XLI": "Industrie", "XLP": "Conso. Base", "XLY": "Conso. Discr.", "XLU": "Utilities",
    "XLB": "Materiaux", "XLRE": "Immobilier", "XLC": "Communication",
}


@router.get("/get-sector-summary")
async def get_sector_summary():
    quotes = await _yahoo_quotes(list(SECTOR_ETFS.keys()))
    sectors = [{"name": SECTOR_ETFS.get(q["symbol"], q["name"]), "symbol": q["symbol"], "price": q["price"], "change_pct": q["change_pct"]} for q in quotes]
    return {"sectors": sectors, "fetched_at": _now()}


# ── Misc stubs ────────────────────────────────────────────────────

@router.get("/list-market-quotes")
async def list_market_quotes():
    """Major market indices."""
    quotes = await _yahoo_quotes(["^GSPC", "^DJI", "^IXIC", "^STOXX50E", "^GDAXI", "^FCHI", "^N225"])
    return {"quotes": quotes, "fetched_at": _now()}


@router.get("/analyze-stock")
async def analyze_stock(symbol: str = Query("AAPL")):
    quotes = await _yahoo_quotes([symbol])
    return {"symbol": symbol, "quote": quotes[0] if quotes else None, "fetched_at": _now()}


@router.get("/get-stock-analysis-history")
async def get_stock_analysis_history(symbol: str = Query("AAPL")):
    return {"symbol": symbol, "history": [], "fetched_at": _now()}


@router.post("/backtest-stock")
async def backtest_stock(symbol: str = Query("AAPL"), strategy: str = Query("ma_crossover")):
    return {"symbol": symbol, "strategy": strategy, "note": "Not implemented", "fetched_at": _now()}


@router.get("/list-stored-stock-backtests")
async def list_stored_stock_backtests():
    return {"backtests": [], "fetched_at": _now()}


@router.get("/list-other-tokens")
async def list_other_tokens(per_page: int = Query(20)):
    return {"tokens": [], "fetched_at": _now()}
