"""
Test de couverture : quelles sources worldmonitor le auto-detector gere ?
On teste fetch + detect (LLM) + parse (no LLM) + validation des resultats.
"""

import json
import sys
import time
import traceback
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))
from source_detector import detect_source, parse_with_template, fetch_raw

# ================================================================
#  Sources a tester, classees par type
# ================================================================

SOURCES = {
    # --- RSS FEEDS (devrait marcher) ---
    "rss_bbc_world": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "rss_guardian": "https://www.theguardian.com/world/rss",
    "rss_npr": "https://feeds.npr.org/1001/rss.xml",
    "rss_france24_en": "https://www.france24.com/en/rss",
    "rss_dw_en": "https://rss.dw.com/xml/rss-en-all",
    "rss_tagesschau": "https://www.tagesschau.de/xml/rss2/",
    "rss_ansa_it": "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml",
    "rss_nos_nl": "https://feeds.nos.nl/nosnieuwsalgemeen",
    "rss_svt_se": "https://www.svt.se/nyheter/rss.xml",

    # --- JSON APIs publiques (devrait marcher) ---
    "json_usgs_quakes": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    "json_eonet": "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=10",
    "json_open_meteo": "https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m,wind_speed_10m",
    "json_nws_alerts": "https://api.weather.gov/alerts/active?limit=10",
    "json_worldbank_gdp": "https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.CD?format=json&per_page=5",
    "json_safecast": "https://api.safecast.org/measurements.json?distance=1000&latitude=35.6762&longitude=139.6503&per_page=10",

    # --- JSON APIs avec auth (va echouer au fetch) ---
    "json_auth_finnhub": "https://finnhub.io/api/v1/quote?symbol=AAPL",
    "json_auth_acled": "https://api.acleddata.com/acled/read?limit=5",
    "json_auth_cloudflare": "https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=5",

    # --- Sources problematiques ---
    "json_coingecko": "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1",
    "rss_aljazeera": "https://www.aljazeera.com/xml/rss/all.xml",
}


def test_fetch_only(name: str, url: str) -> dict:
    """Test 1: est-ce qu'on peut fetcher la source ?"""
    try:
        content_type, raw = fetch_raw(url, truncate=500)
        return {
            "fetch": "OK",
            "content_type": content_type.split(";")[0].strip(),
            "size": len(raw),
            "preview": raw[:200].replace("\n", " ")[:120],
        }
    except Exception as e:
        return {"fetch": "FAIL", "error": str(e)}


def test_full_pipeline(name: str, url: str) -> dict:
    """Test 2: fetch + LLM detect + autonomous parse"""
    result = {"name": name, "url": url}

    # Phase 0: Fetch
    try:
        content_type, raw = fetch_raw(url, truncate=500)
        result["fetch"] = "OK"
        result["content_type"] = content_type.split(";")[0].strip()
        result["raw_size"] = len(raw)
    except Exception as e:
        result["fetch"] = "FAIL"
        result["fetch_error"] = str(e)
        return result

    # Phase 1: LLM detection
    try:
        t0 = time.time()
        template = detect_source(url)
        result["detect"] = "OK"
        result["detect_time"] = round(time.time() - t0, 1)
        result["source_type"] = template.get("source_type")
        result["fields_count"] = len(template.get("fields", []))
        result["fields"] = [f["name"] for f in template.get("fields", [])]
    except Exception as e:
        result["detect"] = "FAIL"
        result["detect_error"] = str(e)
        return result

    # Phase 2: Autonomous parse
    try:
        t0 = time.time()
        rows = parse_with_template(template)
        result["parse"] = "OK"
        result["parse_time"] = round(time.time() - t0, 2)
        result["rows_count"] = len(rows)

        # Validation: combien de champs non-null par row ?
        if rows:
            first = rows[0]
            non_null = sum(1 for v in first.values() if v is not None)
            result["first_row_non_null"] = f"{non_null}/{len(first)}"
            result["sample"] = {k: (str(v)[:60] if v else None) for k, v in first.items()}
        else:
            result["parse"] = "EMPTY"
    except Exception as e:
        result["parse"] = "FAIL"
        result["parse_error"] = str(e)

    return result


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "fetch"

    if mode == "fetch":
        # Quick test: just fetch all sources, no LLM
        print("=" * 70)
        print("  FETCH TEST - Verifier quelles sources sont accessibles")
        print("=" * 70)

        results = {}
        for name, url in SOURCES.items():
            print(f"\n  [{name}] {url[:70]}...")
            r = test_fetch_only(name, url)
            results[name] = r
            status = r["fetch"]
            if status == "OK":
                print(f"    OK  {r['content_type']}  {r['size']} chars")
            else:
                print(f"    FAIL  {r.get('error', '')[:80]}")

        print("\n" + "=" * 70)
        print("  RESULTATS")
        print("=" * 70)
        ok = [k for k, v in results.items() if v["fetch"] == "OK"]
        fail = [k for k, v in results.items() if v["fetch"] == "FAIL"]
        print(f"  OK:   {len(ok)}/{len(results)}")
        for k in ok:
            print(f"    + {k}: {results[k]['content_type']}")
        print(f"  FAIL: {len(fail)}/{len(results)}")
        for k in fail:
            print(f"    - {k}: {results[k].get('error', '')[:60]}")

        Path("prototype/fetch_results.json").write_text(
            json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    elif mode == "full":
        # Full pipeline test on a subset (to not burn too many LLM calls)
        targets = sys.argv[2:] if len(sys.argv) > 2 else list(SOURCES.keys())

        print("=" * 70)
        print(f"  FULL PIPELINE TEST - {len(targets)} sources")
        print("=" * 70)

        results = {}
        for name in targets:
            if name not in SOURCES:
                print(f"  SKIP: {name} not found")
                continue
            url = SOURCES[name]
            print(f"\n{'='*60}")
            print(f"  Testing: {name}")
            print(f"{'='*60}")

            r = test_full_pipeline(name, url)
            results[name] = r

            # Summary
            fetch = r.get("fetch", "?")
            detect = r.get("detect", "?")
            parse = r.get("parse", "?")
            rows = r.get("rows_count", 0)
            fill = r.get("first_row_non_null", "?")
            print(f"\n  >>> {name}: fetch={fetch} detect={detect} parse={parse} rows={rows} fill={fill}")

        # Final summary
        print("\n\n" + "=" * 70)
        print("  FINAL SUMMARY")
        print("=" * 70)

        for name, r in results.items():
            fetch = r.get("fetch", "?")
            detect = r.get("detect", "?")
            parse = r.get("parse", "?")
            rows = r.get("rows_count", 0)
            fill = r.get("first_row_non_null", "?")
            errors = []
            if fetch == "FAIL":
                errors.append(f"fetch: {r.get('fetch_error', '')[:40]}")
            if detect == "FAIL":
                errors.append(f"detect: {r.get('detect_error', '')[:40]}")
            if parse == "FAIL":
                errors.append(f"parse: {r.get('parse_error', '')[:40]}")

            icon = "✓" if parse == "OK" and rows > 0 else "✗" if "FAIL" in [fetch, detect, parse] else "○"
            err_str = f" | {'; '.join(errors)}" if errors else ""
            print(f"  {icon} {name:30s} fetch={fetch:4s} detect={detect:4s} parse={parse:5s} rows={rows:3d} fill={fill}{err_str}")

        Path("prototype/full_results.json").write_text(
            json.dumps(results, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
        )


if __name__ == "__main__":
    main()
