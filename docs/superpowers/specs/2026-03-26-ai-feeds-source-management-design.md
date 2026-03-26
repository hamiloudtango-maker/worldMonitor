# AI Feeds — Gestion intelligente des sources RSS

**Date:** 2026-03-26
**Statut:** Approuvé
**Approche:** Progressive Unification (C)

---

## Vision

Un onglet dédié "AI Feeds" où l'utilisateur construit des thématiques via un query builder visuel assisté par IA. L'IA aide à sélectionner les flux RSS pertinents, filtrer les articles et enrichir les résultats. Chaque thématique sauvegardée devient un widget disponible dans les dashboards et Cases.

**Inspiré de:** Feedly AI Feeds — query builder sémantique, suggestion de sources, filtrage intelligent.

## Principes

- **Ne casse rien** — l'existant (`feeds.ts`, `/list-feed-digest`, variants, widgets) continue de fonctionner tel quel
- **Progressive Unification** — Phase 1 : AI Feeds en parallèle. Phase 2 : variants → templates AI Feed. Phase 3 : pipeline unifié.
- **Scalable** — architecture pensée pour croissance organique du catalogue (builtin → custom → community)
- **IA utile, pas obligatoire** — l'utilisateur peut créer un feed manuellement sans IA

---

## Section 1 — Modèle de données

### `source_catalog` — Catalogue de toutes les sources connues

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | PK |
| `name` | string | Nom de la source (ex: "BBC News") |
| `url` | string | URL du flux RSS |
| `lang` | string | Langue ISO (en, fr, de...) |
| `tier` | int (1-4) | Tier de fiabilité (1=wire, 4=blog) |
| `source_type` | string | wire, gov, intel, mainstream, market, tech, other |
| `country` | string | Pays de la source |
| `continent` | string | Continent |
| `thematic` | string | Thématique (Actualités, Défense, Finance, Tech...) |
| `region` | string | Région géopolitique |
| `propaganda_risk` | string | low, medium, high |
| `origin` | string | `builtin` \| `custom` \| `community` |
| `metadata` | JSON | Extensible (fréquence publication, fiabilité IA...) |
| `created_at` | datetime | |
| `updated_at` | datetime | |

**Seed initial:** ~150 sources de `feeds.ts` (origin: builtin) + ~120 sources pays (origin: builtin) = ~270 sources.

### `ai_feeds` — Thématiques construites par l'utilisateur

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | PK |
| `org_id` | UUID | FK organisation |
| `owner_id` | UUID | FK utilisateur créateur |
| `name` | string | Nom de la thématique |
| `query` | JSON | Structure du query builder (layers, opérateurs, topics, entités, scopes) |
| `ai_config` | JSON | Config IA (seuil pertinence, enrichissements activés) |
| `status` | string | `active` \| `paused` \| `archived` |
| `is_template` | boolean | Pour les variants convertis en templates |
| `created_at` | datetime | |
| `updated_at` | datetime | |

**Structure du champ `query` :**

```json
{
  "layers": [
    {
      "operator": "AND",
      "parts": [
        { "type": "topic", "value": "Partnerships", "scope": "title_and_content" },
        { "type": "entity", "value": "Apple", "aliases": ["Apple Inc.", "AAPL"], "scope": "title_and_content" }
      ]
    },
    {
      "operator": "NOT",
      "parts": [
        { "type": "topic", "value": "Rumors", "scope": "title" }
      ]
    }
  ]
}
```

### `ai_feed_sources` — Sources liées à un feed (N:N)

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | PK |
| `ai_feed_id` | UUID | FK vers ai_feeds |
| `url` | string | URL RSS |
| `name` | string | Nom de la source |
| `lang` | string | Langue |
| `tier` | int | Tier de fiabilité |
| `source_type` | string | Type de source |
| `origin` | string | `catalog` \| `custom` \| `ai_suggested` |
| `enabled` | boolean | Source active dans ce feed |

### `ai_feed_results` — Cache des articles enrichis

| Champ | Type | Description |
|-------|------|-------------|
| `id` | UUID | PK |
| `ai_feed_id` | UUID | FK vers ai_feeds |
| `article_url` | string | URL de l'article |
| `title` | string | Titre |
| `source_name` | string | Nom de la source |
| `published_at` | datetime | Date de publication |
| `relevance_score` | float | Score IA de pertinence (0-100) |
| `entities` | JSON | Entités détectées |
| `summary` | string | Résumé IA (1-2 phrases) |
| `threat_level` | string | Critical, High, Medium, Low |
| `category` | string | Catégorie d'événement |
| `fetched_at` | datetime | Date de fetch |

---

## Section 2 — Onglet AI Feeds : UX et composants

### Layout

**Panneau gauche — Liste des AI Feeds :**
- Liste des thématiques créées (nom, statut, nombre de sources, dernière MAJ)
- Bouton "+ Nouveau Feed"
- Templates préconfigurés avec badge (360 Mondial, Tech, Finance...)
- Actions : dupliquer, archiver, supprimer

**Panneau central — Query Builder :**
- Titre "Collect articles and reports"
- Layers visuels : chaque layer = une rangée avec :
  - Sélecteur d'opérateur entre layers (AND / OR / NOT)
  - Tags de filtres (topics, entités) avec autocomplétion
  - Scope par tag : "Find in Title & Content" / "Find in Title"
- Bouton "+ Add filter" pour ajouter un layer
- Zone texte libre → l'IA traduit en layers/topics
- Preview en temps réel : nombre d'articles matchés

**Panneau droit — Sources :**
- Sources sélectionnées pour ce feed (toggle on/off)
- Section "Suggérées par l'IA" — sources proposées selon la query
- Bouton "Ajouter une URL RSS" pour sources custom
- Filtres rapides : par tier, région, langue, type, pays, continent

**En bas — Aperçu des résultats :**
- 10 derniers articles matchant query + sources
- Score de pertinence, entités détectées, résumé IA
- Validation avant sauvegarde

**Sauvegarde** → le feed apparaît dans le catalogue de widgets.

---

## Section 3 — Backend & API

### Endpoints FastAPI

**CRUD AI Feeds :**
- `POST /ai-feeds` — créer un feed
- `GET /ai-feeds` — lister les feeds de l'org (+ templates)
- `GET /ai-feeds/{id}` — détail d'un feed
- `PUT /ai-feeds/{id}` — modifier query/sources/config
- `DELETE /ai-feeds/{id}` — archiver (soft delete)

**Sources :**
- `GET /ai-feeds/{id}/sources` — sources du feed
- `POST /ai-feeds/{id}/sources` — ajouter une source
- `DELETE /ai-feeds/{id}/sources/{source_id}` — retirer une source
- `GET /source-catalog` — lister le catalogue (~270 sources)
- `POST /source-catalog/validate-url` — valider URL RSS ou auto-découvrir depuis URL de site web

**IA :**
- `POST /ai-feeds/suggest-sources` — query → sources suggérées
- `POST /ai-feeds/parse-query` — texte libre → structure JSON layers/topics/entités
- `POST /ai-feeds/{id}/preview` — preview articles sans sauvegarder

**Résultats :**
- `GET /ai-feeds/{id}/articles` — articles enrichis
- `POST /ai-feeds/{id}/refresh` — force refresh

### Auto-découverte RSS

Quand un utilisateur colle une URL de site (pas RSS), le backend :
1. Fetch la page HTML
2. Scan `<link rel="alternate" type="application/rss+xml">`
3. Propose les flux trouvés
4. Si validé → ajouté au catalogue (`origin: custom`)

### Polling adaptatif

- Tier 1 (Reuters, AP) : 5 min
- Tier 2 (BBC, Guardian) : 15 min
- Tier 3-4 : 30-60 min
- Sources custom peu actives : 2h
- Ajustement automatique basé sur la fréquence de publication observée

### Pipeline de fetch (background worker)

Pour chaque AI Feed actif, périodiquement :
1. Fetch RSS des sources enabled
2. Applique la query (matching layers AND/OR/NOT)
3. Score de pertinence IA sur articles matchés
4. Enrichissement : entités, résumé, threat level
5. Insert/update dans `ai_feed_results`
6. Cache Redis par feed (`rss:aifeed:{feed_id}`)

---

## Section 4 — Intégration Widgets & Dashboards

### Nouveau type de widget : `ai_feed`

- S'ajoute au `widget-catalog.ts` dynamiquement
- `display: 'feed'` — même rendu que les NewsPanel actuels
- `sourceType: 'ai_feed'` avec `sourceId: '{ai_feed_id}'`
- Drag/resize comme les autres widgets

### Intégration dashboard

- Dans "Ajouter un widget", nouvelle section "Mes AI Feeds"
- Drag un AI Feed sur le board → widget créé, alimenté par `GET /ai-feeds/{id}/articles`
- Un même AI Feed peut être placé sur plusieurs dashboards/Cases
- Badge "AI Feed" + nombre de sources + fraîcheur

### Intégration Cases

- Ajouter des AI Feeds comme widgets sur le board d'un Case
- Futur : auto-génération d'un AI Feed depuis les `search_keywords` d'un Case

### Rendu du widget

- Articles triés par pertinence (score IA) ou par date
- Chaque article : titre, source (tier badge), score pertinence, entités en tags
- Clic → lien externe
- Header : nom du feed + bouton "Éditer" → onglet AI Feeds

---

## Section 5 — Découverte et croissance du catalogue

### 3 voies de croissance

1. **`builtin`** — ~270 sources initiales (150 existantes + 120 pays)
2. **`custom`** — ajoutées par utilisateurs (visibles dans leur org)
3. **`community`** — promotion manuelle d'une source custom fiable vers le catalogue global (futur, admin only)

### Effet réseau

Une source custom ajoutée par un utilisateur peut être promue vers le catalogue communautaire, la rendant disponible pour tous.

---

## Section 6 — Pipeline IA

### 3 niveaux d'intelligence

**Niveau 1 — Suggestion de sources** (création du feed)
- L'utilisateur définit sa query (topics, entités, zone géo)
- Le LLM reçoit la query + catalogue complet (~270 sources avec métadonnées)
- Retourne sources classées par pertinence avec justification
- Ex: "M&A Énergie Moyen-Orient" → Gulf News, Arab News, Tehran Times, Times of Oman

**Niveau 2 — Filtrage sémantique** (à chaque refresh)
- Keyword matching rapide (layers AND/OR/NOT) — gratuit, instantané
- Scoring IA sur articles pré-filtrés — pertinence 0-100
- Seuil configurable dans `ai_config` (défaut: 60/100)

**Niveau 3 — Enrichissement** (articles retenus)
- Extraction d'entités : entreprises, personnes, pays, organisations (+ aliases)
- Résumé court (1-2 phrases)
- Classification : threat_level + category
- Stockage dans `ai_feed_results`

**Modèle IA :** Gemini Flash — rapide et économique pour du batch processing.

**Coût maîtrisé :** Niveau 1 one-shot. Niveau 2 keyword gratuit. Scoring IA + enrichissement uniquement sur articles pré-filtrés.

---

## Phases de livraison

### Phase 1 — MVP
- Onglet AI Feeds avec query builder visuel (AND/OR/NOT, topics, entités, scopes)
- Catalogue de ~270 sources (seed)
- Suggestion IA de sources
- Feed de résultats avec filtrage + enrichissement
- AI Feeds → widgets dans les dashboards
- Ajout d'URLs custom

### Phase 2 — Migration variants
- Variants actuels (360 Mondial, Tech, Finance) → templates AI Feed préconfigurés
- Utilisateur peut dupliquer/modifier les templates
- Polling adaptatif par tier

### Phase 3 — Unification
- Pipeline unifié fetch/filtre/enrichissement pour AI Feeds et anciens feeds
- Promotion community des sources custom
- Auto-génération d'AI Feed depuis les Cases
