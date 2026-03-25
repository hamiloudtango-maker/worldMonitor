# Source Auto-Detector Prototype

## Concept

Systeme en 2 phases pour ajouter des sources de donnees a un dashboard d'intelligence :

1. **Phase 1 (LLM, une seule fois)** : On donne une URL -> fetch du contenu -> Gemini Flash detecte le format, les champs, la categorie, et genere un template JSON.
2. **Phase 2 (autonome, repetable)** : Le template sauvegarde est utilise pour parser la source a chaque refresh. Zero appel LLM.

## Architecture

```
User colle une URL
       |
       v
  Phase 1: fetch + Gemini Flash (une seule fois)
       |
       v
  Template JSON sauvegarde dans templates/
       |
       v
  Phase 2: fetch + parse avec jsonpath-ng/lxml (toutes les X sec, sans LLM)
       |
       v
  Donnees normalisees pret pour affichage
```

## Stack

- **Python 3.14+**
- **Vertex AI** : Gemini 2.5 Flash via endpoint OpenAI-compatible
- **jsonpath-ng** : Resolution jsonpath pour les APIs JSON (gere `$[*]`, `coordinates[1]`, nested arrays)
- **lxml** : XPath complet pour RSS/XML (gere namespaces, attributs `/@url`)
- **httpx** : HTTP client async-ready
- **google-auth** : ADC pour Vertex AI

## Configuration Vertex AI

- Project: `gen-lang-client-0965475468`
- Location: `us-central1`
- Model: `gemini-2.5-flash`
- Auth: Application Default Credentials (ADC)

## Fichiers

```
prototype/
  source_detector.py       # Code principal (Phase 1 + Phase 2)
  test_extra_sources.py    # Test NASA EONET + Al Jazeera
  test_new_source.py       # Test NOAA Solar Flares
  templates/               # Templates generes par le LLM (persistes)
  results.json             # Dernier run complet
  .venv/                   # Environnement virtuel Python
  README.md                # Ce fichier
```

## Sources testees (6/6 OK)

| Source | Type | Items | lat/lon | Temps parse |
|--------|------|-------|---------|-------------|
| BBC World RSS | rss | 40 | n/a | 0.39s |
| USGS Earthquakes | json_api | 11 | OK | 2.41s |
| CoinGecko Crypto | json_api | 10 | n/a | 0.52s |
| NASA EONET | json_api | 20 | OK | 0.94s |
| Al Jazeera RSS | rss | 25 | n/a | 0.35s |
| NOAA Solar Flares | json_api | 1 | n/a | 0.54s |

## Template genere (exemple USGS)

```json
{
  "source_id": "usgs_significant_earthquakes",
  "source_type": "json_api",
  "category": "natural_disaster",
  "refresh_seconds": 300,
  "fields": [
    {"name": "title", "path": "$.events[*].properties.title", "type": "string"},
    {"name": "magnitude", "path": "$.features[*].properties.mag", "type": "number"},
    {"name": "latitude", "path": "$.features[*].geometry.coordinates[1]", "type": "geo_lat"},
    {"name": "longitude", "path": "$.features[*].geometry.coordinates[0]", "type": "geo_lon"}
  ],
  "panel": {
    "title": "USGS Significant Earthquakes",
    "display": "map_markers",
    "columns": ["title", "magnitude", "alert"]
  }
}
```

## Points cles du prompt LLM

- JSON: paths **absolus** avec `[*]` (ex: `$.events[*].title`) pour que jsonpath-ng resolve directement
- RSS/XML: paths **relatifs** a chaque item (ex: `title`, `media:thumbnail/@url`)
- Max 10 fields, les plus importants
- Namespaces declares dans le template pour lxml

## Limites actuelles

- RSS + JSON REST uniquement (~40% des sources worldmonitor)
- Pas de WebSocket, SSE, Protobuf, HTML scrape
- Pas de scheduler, dedup, stockage, circuit breaker
- Pas de validation automatique du template genere
- Pas de gestion auth/API keys par source

## Usage

```bash
cd prototype
.venv/Scripts/python source_detector.py          # Run les 3 sources principales
.venv/Scripts/python test_extra_sources.py        # Test EONET + Al Jazeera
.venv/Scripts/python test_new_source.py           # Test NOAA Solar Flares
```

## Setup

```bash
cd prototype
python -m venv .venv
.venv/Scripts/pip install jsonpath-ng lxml httpx google-auth requests
```
