"""
Source Auto-Detector Prototype
------------------------------
Phase 1 (une seule fois) : URL -> fetch -> Gemini Flash detecte le format -> genere un template
Phase 2 (toutes les X sec) : le template sauvegarde parse la source SANS appeler l'IA

Parsers: jsonpath-ng (JSON), lxml (RSS/XML)
"""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
import google.auth
from google.auth.transport.requests import Request
from jsonpath_ng.ext import parse as jsonpath_parse
from lxml import etree

# -- Vertex AI config (from riskguard) --------------------------
GCP_PROJECT = "gen-lang-client-0965475468"
GCP_LOCATION = "us-central1"
MODEL = "google/gemini-2.5-flash"

TEMPLATES_DIR = Path("prototype/templates")
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

_cached_creds = None


def _get_token() -> str:
    global _cached_creds
    if _cached_creds is None:
        _cached_creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    _cached_creds.refresh(Request())
    return _cached_creds.token


def call_gemini(prompt: str) -> str:
    token = _get_token()
    base_url = (
        f"https://{GCP_LOCATION}-aiplatform.googleapis.com/v1/"
        f"projects/{GCP_PROJECT}/locations/{GCP_LOCATION}/endpoints/openapi"
    )
    resp = httpx.post(
        f"{base_url}/chat/completions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 8192,
            "temperature": 0.1,
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


# -- Fetching ---------------------------------------------------

def fetch_raw(url: str, truncate: int = 0) -> tuple[str, str]:
    resp = httpx.get(
        url,
        headers={"User-Agent": "WorldMonitor/1.0"},
        timeout=30,
        follow_redirects=True,
    )
    resp.raise_for_status()
    text = resp.text[:truncate] if truncate else resp.text
    return resp.headers.get("content-type", ""), text


# ================================================================
#  PHASE 1 : LLM detection (one-time per source)
# ================================================================

DETECT_PROMPT = """Tu es un expert en integration de sources de donnees.

Analyse ce contenu brut depuis : {url}
Content-Type : {content_type}

--- CONTENU ---
{content}
--- FIN ---

Reponds UNIQUEMENT en JSON valide (pas de markdown, pas de ```).
Limite-toi aux champs les plus importants (max 10 fields).

IMPORTANT pour les paths :
- Pour JSON : utilise la syntaxe jsonpath ABSOLUE avec [*] pour iterer sur les arrays.
  Exemples : $.features[*].properties.mag, $.events[*].title, $[*].current_price
  NE PAS utiliser de paths relatifs sans [*].
- Pour RSS/XML : utilise des paths XPath RELATIFS a chaque item (pas de //item/ prefix).
  Exemples : title, description, link, media:thumbnail/@url

{{
  "source_id": "identifiant_court_unique",
  "source_type": "rss | json_api | html_scrape | csv",
  "category": "news | markets | conflict | natural_disaster | crypto | economic | weather | tech | military",
  "refresh_seconds": 300,
  "namespaces": {{"prefix": "uri"}},
  "fields": [
    {{
      "name": "champ",
      "path": "jsonpath ou xpath (relatif a chaque item)",
      "type": "string | number | date_ms | date_iso | geo_lat | geo_lon | url"
    }}
  ],
  "panel": {{
    "title": "Titre du panel",
    "display": "feed | table | chart | map_markers | metric_cards",
    "columns": ["col1", "col2", "col3"]
  }}
}}
"""


def detect_source(url: str) -> dict:
    print(f"\n{'='*60}")
    print(f"PHASE 1 - LLM Detection: {url}")
    print(f"{'='*60}")

    content_type, raw = fetch_raw(url, truncate=8000)
    print(f"  Content-Type: {content_type}")
    print(f"  Fetched: {len(raw)} chars (truncated for LLM)")

    print(f"  Calling Gemini Flash...")
    t0 = time.time()
    result_text = call_gemini(DETECT_PROMPT.format(
        url=url, content_type=content_type, content=raw,
    ))
    elapsed = time.time() - t0
    print(f"  LLM responded in {elapsed:.1f}s")

    cleaned = result_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]

    template = json.loads(cleaned.strip())
    template["url"] = url
    template["content_type_hint"] = content_type.split(";")[0].strip()
    template["created_at"] = datetime.now(timezone.utc).isoformat()

    tpl_path = TEMPLATES_DIR / f"{template['source_id']}.json"
    tpl_path.write_text(json.dumps(template, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  Template saved: {tpl_path}")

    return template


# ================================================================
#  PHASE 2 : Autonomous parsing (NO LLM) using jsonpath-ng + lxml
# ================================================================

def _parse_rss(raw: str, fields: list[dict], namespaces: dict) -> list[dict]:
    """Parse RSS/XML using lxml XPath. Fully driven by template."""
    root = etree.fromstring(raw.encode("utf-8"))

    # Build namespace map: merge standard RSS namespaces + LLM-detected ones
    nsmap = {
        "media": "http://search.yahoo.com/mrss/",
        "dc": "http://purl.org/dc/elements/1.1/",
        "atom": "http://www.w3.org/2005/Atom",
        "content": "http://purl.org/rss/1.0/modules/content/",
    }
    if namespaces:
        nsmap.update(namespaces)

    # Find items (RSS 2.0 or Atom)
    items = root.xpath("//item", namespaces=nsmap)
    if not items:
        items = root.xpath("//atom:entry", namespaces=nsmap)

    rows = []
    for item in items:
        row = {}
        for f in fields:
            xpath = f["path"]
            # Make path relative to item: //item/title -> title, /rss/channel/item/title -> title
            # Strip everything up to and including the item/entry tag
            for prefix in ["//item/", "//entry/", "/rss/channel/item/", "/feed/entry/"]:
                if xpath.startswith(prefix):
                    xpath = xpath[len(prefix):]
                    break
            # If still starts with /, strip it
            xpath = xpath.lstrip("/")

            results = item.xpath(xpath, namespaces=nsmap)
            if results:
                val = results[0]
                # lxml returns Element for tags, str for text()/@attr
                if isinstance(val, etree._Element):
                    row[f["name"]] = val.text
                else:
                    row[f["name"]] = str(val)
            else:
                row[f["name"]] = None
        rows.append(row)
    return rows


def _parse_json(raw: str, fields: list[dict]) -> list[dict]:
    """Parse JSON using jsonpath-ng. Fully driven by template."""
    data = json.loads(raw)

    # Detect if paths are relative (no [*]) or absolute (with [*])
    # If relative, we need to find the items array first and apply per-item
    sample_path = fields[0]["path"] if fields else "$"
    has_wildcard = "[*]" in sample_path or ".[*]" in sample_path

    if has_wildcard:
        # Absolute paths like $.features[*].properties.mag
        # jsonpath-ng handles these directly
        columns: dict[str, list] = {}
        max_len = 0
        for f in fields:
            path = f["path"]
            try:
                expr = jsonpath_parse(path)
                matches = expr.find(data)
                values = [m.value for m in matches]
            except Exception:
                values = []
            columns[f["name"]] = values
            max_len = max(max_len, len(values))

        rows = []
        for i in range(max_len):
            row = {}
            for f in fields:
                vals = columns[f["name"]]
                row[f["name"]] = vals[i] if i < len(vals) else None
            rows.append(row)
        return rows
    else:
        # Relative paths like $.properties.mag (no [*])
        # Data is either a list of objects, or has an array we need to find
        items = data if isinstance(data, list) else None

        if items is None:
            # Try to find the main array (e.g. "features", "results", "data")
            for key in ("features", "results", "data", "items", "records", "entries"):
                if isinstance(data.get(key), list):
                    items = data[key]
                    break

        if items is None:
            items = [data]  # Single object

        rows = []
        for item in items:
            row = {}
            for f in fields:
                path = f["path"]
                # Strip leading $. for relative resolution
                rel_path = "$." + path.lstrip("$.")
                try:
                    expr = jsonpath_parse(rel_path)
                    matches = expr.find(item)
                    row[f["name"]] = matches[0].value if matches else None
                except Exception:
                    row[f["name"]] = None
            rows.append(row)
        return rows


def parse_with_template(template: dict) -> list[dict]:
    """Phase 2: Fetch + parse using saved template. NO LLM call."""
    url = template["url"]
    source_type = template["source_type"]
    fields = template["fields"]
    namespaces = template.get("namespaces", {})

    print(f"\n  PHASE 2 - Autonomous parse: {template['source_id']}")
    print(f"  Fetching {url}...")

    _, raw = fetch_raw(url)

    if source_type == "rss":
        return _parse_rss(raw, fields, namespaces)
    elif source_type == "json_api":
        return _parse_json(raw, fields)
    else:
        print(f"  Unsupported source_type: {source_type}")
        return []


# ================================================================
#  Main
# ================================================================

TEST_SOURCES = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1",
]


def main():
    templates = []

    # -- PHASE 1: Detect all sources (LLM) --
    print("\n" + "#" * 60)
    print("  PHASE 1: LLM-powered source detection")
    print("#" * 60)

    for url in TEST_SOURCES:
        try:
            tpl = detect_source(url)
            templates.append(tpl)

            print(f"\n  Result:")
            print(f"    ID:       {tpl.get('source_id')}")
            print(f"    Type:     {tpl.get('source_type')}")
            print(f"    Category: {tpl.get('category')}")
            print(f"    Fields:   {len(tpl.get('fields', []))}")
            print(f"    Panel:    {tpl.get('panel', {}).get('title')}")
            print(f"    Display:  {tpl.get('panel', {}).get('display')}")
            print(f"    Refresh:  {tpl.get('refresh_seconds')}s")
            for f in tpl.get("fields", []):
                print(f"      - {f['name']:20s} ({f['type']:10s}) {f['path']}")

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()

    # -- PHASE 2: Parse without LLM --
    print("\n\n" + "#" * 60)
    print("  PHASE 2: Autonomous parsing (NO LLM)")
    print("#" * 60)

    for tpl in templates:
        try:
            t0 = time.time()
            rows = parse_with_template(tpl)
            elapsed = time.time() - t0

            print(f"  Parsed {len(rows)} items in {elapsed:.2f}s (no LLM)")
            for i, row in enumerate(rows[:3]):
                summary = {k: (str(v)[:60] if v else None) for k, v in row.items()}
                print(f"    [{i}] {json.dumps(summary, ensure_ascii=False)}")
            if len(rows) > 3:
                print(f"    ... +{len(rows)-3} more")

        except Exception as e:
            print(f"  PARSE ERROR for {tpl.get('source_id')}: {e}")
            import traceback
            traceback.print_exc()

    # Save summary
    summary_path = Path("prototype/results.json")
    summary = {}
    for tpl in templates:
        try:
            rows = parse_with_template(tpl)
            summary[tpl["source_id"]] = {
                "template": tpl,
                "sample_data": rows[:5],
                "total_items": len(rows),
            }
        except Exception as e:
            summary[tpl["source_id"]] = {"template": tpl, "parse_error": str(e)}
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"\nFull results saved to {summary_path}")


if __name__ == "__main__":
    main()
