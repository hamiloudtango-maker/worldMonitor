"""
Source detector — LLM-powered one-shot source format detection.
Port of prototype/source_detector.py Phase 1.
Uses Vertex AI Gemini Flash via OpenAI-compatible endpoint.
"""

import json

import google.auth
import google.auth.transport.requests
import httpx

from app.config import settings
from app.source_engine.schemas import SourceTemplate

_cached_creds = None

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
  "source_type": "rss | json_api",
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


def _get_token() -> str:
    global _cached_creds
    if _cached_creds is None:
        _cached_creds, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    _cached_creds.refresh(google.auth.transport.requests.Request())
    return _cached_creds.token


async def get_gemini_token() -> str:
    """Get a valid GCP token (async-safe, cached)."""
    import asyncio
    return await asyncio.to_thread(_get_token)


def get_gemini_url() -> str:
    return (
        f"https://{settings.gcp_location}-aiplatform.googleapis.com/v1/"
        f"projects/{settings.gcp_project}/locations/{settings.gcp_location}/endpoints/openapi"
        f"/chat/completions"
    )


async def call_gemini(prompt: str, *, client: httpx.AsyncClient | None = None, token: str | None = None) -> str:
    """Call Gemini. Accepts optional shared client+token for batch efficiency."""
    if token is None:
        token = await get_gemini_token()

    url = get_gemini_url()
    body = {
        "model": settings.gemini_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 8192,
        "temperature": 0.1,
        "thinking": {"type": "disabled"},
    }
    headers = {"Authorization": f"Bearer {token}"}

    if client:
        resp = await client.post(url, headers=headers, json=body)
    else:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(url, headers=headers, json=body)

    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


# Legacy alias
async def _call_gemini(prompt: str) -> str:
    return await call_gemini(prompt)


async def fetch_raw(url: str, truncate: int = 0) -> tuple[str, str]:
    """Fetch URL and return (content_type, text)."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "WorldMonitor/2.0"})
        resp.raise_for_status()
        text = resp.text[:truncate] if truncate else resp.text
        return resp.headers.get("content-type", ""), text


async def detect_source(url: str) -> SourceTemplate:
    """Phase 1: Fetch URL → LLM detection → SourceTemplate."""
    content_type, raw = await fetch_raw(url, truncate=8000)

    prompt = DETECT_PROMPT.format(
        url=url,
        content_type=content_type,
        content=raw,
    )

    result_text = await _call_gemini(prompt)

    # Clean markdown fences if present
    cleaned = result_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]

    data = json.loads(cleaned.strip())
    data["url"] = url
    data["enabled"] = True

    return SourceTemplate(**data)
