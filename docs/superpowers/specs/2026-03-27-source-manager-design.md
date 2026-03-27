# Source Manager — Configuration Page

## Goal

Add a full RSS source management panel to the Configuration page. Users can view, filter, search, group, add, edit, activate/deactivate, and bulk-manage all RSS sources that feed the platform.

## Architecture

A new `SourceManager.tsx` component renders a filterable, groupable data table of all `rss_catalog` entries. It uses the existing `/ai-feeds/catalog/sources` API (enriched) plus 3 new endpoints for PATCH/DELETE/bulk-action. The component is embedded in the `settings` section of `Dashboard.tsx`.

## Data Source

The `rss_catalog` DB table (unified, 169+ sources). Model fields:
- `id`, `url`, `name`, `lang`, `tier`, `source_type`, `country`, `continent`
- `tags` (JSON array), `origin` ("builtin"/"custom"), `active` (bool)
- `description` (text), `last_fetched_at` (datetime), `fetch_error_count` (int)

## UI Layout

### Header Row
- Title: "Sources RSS" with total count badge
- Search bar (text, filters on name/URL/country)
- Group-by toggle: `Liste` | `Par thématique` | `Par pays`
- Button: "+ Ajouter"

### Filter Bar (below header)
Dropdown filters, all populated from distinct DB values:
- **Continent**: Europe, Asie, Afrique, Amerique du Nord, Amerique du Sud, Oceanie, Moyen-Orient
- **Pays**: filtered by selected continent
- **Tags**: all unique tag values extracted from JSON arrays
- **Tier**: 1 (Wire) / 2 (Major) / 3 (Specialty) / 4 (Aggregator)
- **Statut**: Actif / Degraded / Erreur / Disabled

### Bulk Action Bar (contextual, appears when rows selected)
- "N selected" label
- Buttons: Activer | Desactiver | Supprimer (with confirmation dialog)

### Data Table

Columns:
| Column | Content |
|--------|---------|
| Checkbox | Row selection for bulk actions |
| Nom | Source name |
| Pays | Country |
| Tags | Tag chips |
| Tier | 1-4 with label |
| Statut | Color indicator (see below) |
| Dernier fetch | Relative time ("il y a 5min") or "jamais" |
| Erreurs | fetch_error_count |
| Actions | Toggle switch + Edit button + Delete button |

### Status Indicators
- **Green (Actif)**: `active=true`, `fetch_error_count < 3`
- **Yellow (Degraded)**: `active=true`, `fetch_error_count >= 3`
- **Red (Erreur)**: `active=true`, `fetch_error_count >= 10`
- **Gray (Disabled)**: `active=false`

### View Modes (group-by toggle)

**Liste (default):** Flat table sorted by name. Standard pagination (50 per page).

**Par thematique:** Rows grouped by tag. Each group has a collapsible header showing the tag name + count. Sources with multiple tags appear in each matching group. Groups sorted alphabetically.

**Par pays:** Two-level grouping — Continent > Country. Collapsible continent headers, then country sub-headers within each continent. Sorted alphabetically at each level.

### Pagination
- 50 rows per page (flat mode)
- In grouped modes, all sources shown with collapsible groups (no pagination)

### Edit Modal
Opens on row edit-button click. Editable fields:
- Name (text)
- Tags (multi-select / chip input)
- Tier (dropdown 1-4)
- Country (text)
- Continent (dropdown)
- Description (textarea)
- Active (toggle)

Read-only fields displayed: URL, origin, last_fetched_at, fetch_error_count, created_at

### Add Modal
- Textarea: one URL per line
- Button: "Valider & categoriser"
- Progress: spinner per URL, then result (success + detected metadata, or error message)
- Uses existing `POST /ai-feeds/catalog/bulk-add` endpoint

## API Changes

### Existing endpoint — enrich response

`GET /api/ai-feeds/catalog/sources`

Add to response object per source:
```json
{
  "id": "uuid",
  "name": "...", "url": "...", "lang": "...", "tier": 1,
  "source_type": "...", "country": "...", "continent": "...",
  "tags": ["Actualites"],
  "active": true,
  "description": "...",
  "origin": "builtin",
  "last_fetched_at": "2026-03-27T08:00:00Z",
  "fetch_error_count": 0
}
```

### New endpoint — edit source

`PATCH /api/ai-feeds/catalog/{id}`

Body: partial update of `name`, `tags`, `tier`, `country`, `continent`, `description`, `active`

Returns updated source object.

### New endpoint — delete source

`DELETE /api/ai-feeds/catalog/{id}`

Returns `{"ok": true}`. Only allows deleting `origin="custom"` sources. Builtin sources can only be deactivated.

### New endpoint — bulk action

`POST /api/ai-feeds/catalog/bulk-action`

Body:
```json
{
  "ids": ["uuid1", "uuid2"],
  "action": "activate" | "deactivate" | "delete"
}
```

Returns `{"affected": N}`. Delete only works on custom sources; builtin sources in the list are deactivated instead.

## Frontend Files

| Action | File |
|--------|------|
| Create | `src/v2/components/SourceManager.tsx` — main component |
| Create | `src/v2/lib/source-manager-api.ts` — API functions |
| Modify | `src/v2/components/Dashboard.tsx` — embed SourceManager in settings view |

## Constraints

- Light theme, Tailwind, consistent with existing UI patterns
- Interface in French (labels, buttons, status text)
- No external UI library — use native HTML elements + Tailwind
- Responsive: table scrolls horizontally on small screens
