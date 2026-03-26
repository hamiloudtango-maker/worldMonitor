# WorldMonitor — Cases Intelligence Platform Design

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Backend (new tables + endpoints) + Frontend (rewrite navigation + cases + board + 360 view)

---

## 1. Overview

Transform WorldMonitor from a news dashboard into a case-based intelligence platform. Users create **Cases** to track entities (companies, persons, countries, thematics). Each case has an auto-generated identity card, triggers automatic article ingestion, and provides a customizable Gridstack board for investigation.

### Core User Flow

1. User creates a case (e.g., "TotalEnergies", type: company)
2. Backend auto-generates an identity card via Gemini Flash LLM
3. Backend immediately ingests articles from GDELT + Google News using the entity name
4. Articles are enriched (classify, NER, translate) by the existing pipeline
5. User sees the case in their list with live article count and alerts
6. Double-click opens a Gridstack board with widgets (identity, map, articles, sentiment, etc.)
7. Scheduler refreshes articles every 30 minutes for all active cases
8. Articles older than 3 days are purged automatically

### Navigation Structure

| Tab | Purpose |
|-----|---------|
| **Tableau de bord** | Synthesis across all user's cases: aggregated KPIs, map showing only case-related countries, alerts from cases, top articles |
| **Cases** | CRUD list of tracked entities. Filterable by type. Double-click opens case board |
| **360 Mondial** | Unfiltered global WorldMonitor view: ALL articles, full world heatmap, global stats. Not scoped to cases |
| **Rapports** | Generate synthesis reports (placeholder for MVP) |
| **Configuration** | Account, sources, settings, logout |

---

## 2. Data Model

### Table: `cases`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `org_id` | UUID FK → orgs | Tenant scoping |
| `owner_id` | UUID FK → users | Creator |
| `name` | VARCHAR(200) | Entity name: "TotalEnergies", "Taïwan", "Elon Musk" |
| `type` | VARCHAR(20) | company, person, country, thematic |
| `search_keywords` | VARCHAR(500) | Auto-generated from name. Used for GDELT/Google News queries |
| `identity_card` | JSON | LLM-generated fiche: {description, headquarters, sector, country_code, founded, website, key_people, revenue} |
| `status` | VARCHAR(10) | active (default), archived |
| `created_at` | DATETIME(tz) | |
| `updated_at` | DATETIME(tz) | |

**Indexes:** `org_id`, `(org_id, status)`

### Table: `case_boards`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `case_id` | UUID FK → cases (unique) | One board per case |
| `layout` | JSON | Gridstack widget layout: [{id, x, y, w, h, widget_type, config}] |
| `created_at` | DATETIME(tz) | |
| `updated_at` | DATETIME(tz) | |

### No `case_articles` join table

Articles are NOT duplicated or linked via FK. The relationship is **dynamic**: each case's `search_keywords` and `name` are used to query the existing `articles` table via `GET /articles/v1/search?q={keywords}&entity={name}`. This avoids data duplication and leverages the existing search infrastructure.

---

## 3. API Endpoints

### Cases CRUD — `POST/GET/PUT/DELETE /api/cases`

**POST /api/cases** (Auth required)
- Request: `{ "name": "TotalEnergies", "type": "company" }`
- Backend actions:
  1. Generate `search_keywords` from name (lowercase, key variants)
  2. Call Gemini Flash to generate `identity_card` JSON
  3. Create case record + empty board
  4. Trigger initial ingestion: `ingest-google-news?query={name}` + `ingest-gdelt?query={name}`
- Response: `{ "id": "uuid", "name": "...", "type": "...", "identity_card": {...}, "status": "active", "article_count": 0, "alert_count": 0 }`

**GET /api/cases** (Auth required)
- Returns all cases for the user's org
- Each case includes live `article_count` and `alert_count` (articles matching keywords with threat=critical|high)
- Response: `[{ "id", "name", "type", "identity_card", "status", "article_count", "alert_count", "created_at" }]`

**GET /api/cases/{id}** (Auth required)
- Full case detail with identity_card

**PUT /api/cases/{id}** (Auth required)
- Update: name, search_keywords, identity_card (manual correction), status
- Response: updated case

**DELETE /api/cases/{id}** (Auth required)
- Deletes case + its board (cascade)

### Case Articles — `/api/cases/{id}/articles`

**GET /api/cases/{id}/articles** (Auth required)
- Internally queries `articles` table with: `q={search_keywords}` OR `entity LIKE {name}`
- Query params: `limit` (default 50), `offset`, `threat` (filter by threat level)
- Response: same shape as `/articles/v1/search`

**GET /api/cases/{id}/stats** (Auth required)
- Stats scoped to case's articles
- Response: `{ "total", "by_threat": {...}, "by_theme": {...}, "by_day": [{"date": "2026-03-25", "count": 12}, ...] }`

**POST /api/cases/{id}/ingest** (Auth required)
- Force immediate refresh for this case
- Triggers GDELT + Google News ingestion with case's search_keywords
- Response: `{ "fetched", "inserted" }`

### Case Board — `/api/cases/{id}/board`

**GET /api/cases/{id}/board** (Auth required)
- Response: `{ "case_id", "layout": [...] }`

**PUT /api/cases/{id}/board** (Auth required)
- Save Gridstack layout
- Request: `{ "layout": [{"id": "widget-1", "x": 0, "y": 0, "w": 4, "h": 3, "widget_type": "identity_card", "config": {}}] }`

### Identity Card LLM Prompt

```
Generate a JSON identity card for "{name}" (type: {type}).
Fields:
- description: 2 sentences max
- headquarters: city, country
- sector: industry/domain
- country_code: ISO-2
- founded: year (null if unknown)
- website: URL (null if unknown)
- key_people: array of max 3 names with roles
- revenue: string with currency (null if unknown)
Respond with valid JSON only.
```

---

## 4. Frontend Architecture

### File Structure (inside `src/v2/`)

```
components/
  Dashboard.tsx      — Rewrite: synthesis of all cases
  CasesView.tsx      — Cases list + create modal + filters
  CaseBoard.tsx      — Gridstack board for single case
  WorldView.tsx      — 360 Mondial (global unfiltered view)
  LiveMap.tsx         — MapLibre component (reuse existing)
  AuthPage.tsx        — Keep as-is
  CreateCaseModal.tsx — Modal: name + type → create
  IdentityCard.tsx    — Editable case identity widget
hooks/
  useAuth.ts          — Keep as-is
  useCases.ts         — CRUD + polling for cases
lib/
  api.ts              — Keep as-is (add case endpoints)
  constants.ts        — Keep as-is
App.tsx               — Keep as-is
main.tsx              — Keep as-is
```

### Dashboard Tab (Tableau de bord)

Shows synthesis of ALL active cases:
- KPIs: total cases, total articles across cases, critical alerts, countries covered
- Map: shows only countries from case identity_cards (not all articles)
- Alert feed: critical/high articles matching ANY case
- Top articles: most recent across all cases

### Cases Tab

- Grid of case cards, each showing: name, type icon, identity_card.description, article_count, alert_count badge
- Filter bar: All / Companies / Countries / Persons / Thematics
- Button "Créer un case" → opens CreateCaseModal
- Single click: selects case (highlights, filters dashboard by this case)
- Double-click: opens CaseBoard (full-screen overlay with back button)

### Case Board (double-click)

Full-screen Gridstack dashboard. Available widgets:
- **Identity Card** — LLM-generated fiche, editable fields
- **Map** — MapLibre centered on entity's country
- **Articles** — Scrollable list of matched articles
- **Timeline** — Bar chart: articles per day (last 7 days)
- **Alerts** — Critical/high articles for this case
- **Sentiment** — Area chart: threat distribution over time
- **Themes** — Horizontal bar chart: article themes

Default layout (new board):
```
[identity_card: 0,0,4,3] [map: 4,0,8,5]
[alerts: 0,3,4,4]        [articles: 4,5,8,4]
[sentiment: 0,7,6,3]     [themes: 6,7,6,3]
```

User can drag/resize/add/remove widgets. Layout saved via `PUT /cases/{id}/board`.

### 360 Mondial Tab

Reuses existing WorldMonitor logic:
- Full MapLibre heatmap of ALL articles (no case filter)
- Global stats from `/articles/v1/stats`
- Full article feed from `/articles/v1/search`
- Sentiment + thematic charts from global data

---

## 5. Scheduler & Data Lifecycle

### Case Ingestion Scheduler

- Runs every 30 minutes
- Queries all cases with `status=active`
- For each case: calls `ingest-google-news?query={search_keywords}` and `ingest-gdelt?query={search_keywords}`
- Articles go through existing pipeline (dedup → classify → NER → translate)
- Staggered startup (random 0-5s delay per case to avoid burst)

### Article Retention (3 days)

- Cron job runs every hour
- Deletes articles where `created_at < now() - 3 days`
- Cases continue working because they query live data

### Alert Detection

- No separate alerts table for MVP
- An "alert" = any article with `threat_level IN (critical, high)` that matches a case's search_keywords
- Frontend polls `/cases/{id}/articles?threat=critical` to display alerts
- Alert count shown on case card and in sidebar badge

---

## 6. Implementation Order

1. **Backend: models + migrations** — `cases` and `case_boards` tables
2. **Backend: cases CRUD endpoints** — POST/GET/PUT/DELETE
3. **Backend: case articles + stats endpoints** — query articles by case keywords
4. **Backend: case board endpoints** — GET/PUT layout
5. **Backend: identity card LLM** — Gemini Flash generation on case creation
6. **Backend: case scheduler** — 30-min refresh loop for active cases
7. **Backend: retention cron** — 3-day article cleanup
8. **Frontend: Cases view** — list + create modal
9. **Frontend: Dashboard rewrite** — synthesis across cases
10. **Frontend: Case Board** — Gridstack with widgets
11. **Frontend: 360 Mondial** — global unfiltered view
12. **Frontend: wire everything** — connect all views to API
