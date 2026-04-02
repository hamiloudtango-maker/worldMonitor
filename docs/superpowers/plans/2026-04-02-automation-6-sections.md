# Automation 6-Section Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement all 6 automation sections (Rules, Filters, Spotlights, Email Digests, OPML, Reports) with full backend-frontend integration, matching Inoreader's automation UX.

**Architecture:** Backend already has Rules engine (evaluator/executor/runner/router), Spotlights CRUD, Digest model+generator. We add: Digest CRUD router, OPML import/export endpoints, AutoReport model+router. Frontend: rewrite AutomateView.tsx into 6 connected sections with forms, lists, and real-time state. SQLite dev uses create_all — models auto-create tables.

**Tech Stack:** Python/FastAPI, SQLAlchemy async, React/TypeScript, Tailwind, Lucide icons, useTheme()

---

## File Structure

### Backend (new/modified)
- **Create:** `server-py/app/notifications/digests_router.py` — Digest CRUD API
- **Create:** `server-py/app/automation/reports_model.py` — AutoReport model
- **Create:** `server-py/app/automation/reports_router.py` — Reports CRUD API
- **Create:** `server-py/app/domains/sources/opml_router.py` — OPML import/export
- **Modify:** `server-py/app/main.py` — Register new routers + import reports model

### Frontend (new/modified)
- **Modify:** `src/v2/lib/api.ts` — Add API functions for all 6 sections
- **Rewrite:** `src/v2/components/AutomateView.tsx` — 6 connected sections

---

## Task 1: Backend — Digests CRUD Router

**Files:**
- Create: `server-py/app/notifications/digests_router.py`
- Modify: `server-py/app/main.py:9` (add to ROUTERS)

Endpoints: GET /, POST /, PUT /{id}, DELETE /{id}, POST /{id}/preview

---

## Task 2: Backend — AutoReport Model + Router

**Files:**
- Create: `server-py/app/automation/__init__.py`
- Create: `server-py/app/automation/reports_model.py`
- Create: `server-py/app/automation/reports_router.py`
- Modify: `server-py/app/main.py` (add router + model import)

Model: id, org_id, owner_id, name, scope_type, scope_id, frequency, format(markdown|html), template_prompt, enabled, last_generated_at, last_content
Endpoints: GET /, POST /, PUT /{id}, DELETE /{id}, POST /{id}/generate

---

## Task 3: Backend — OPML Import/Export

**Files:**
- Create: `server-py/app/domains/sources/opml_router.py`
- Modify: `server-py/app/main.py` (add router)

Endpoints: GET /opml/v1/export (XML download), POST /opml/v1/import (file upload)

---

## Task 4: Frontend — API Functions

**Files:**
- Modify: `src/v2/lib/api.ts`

Add typed functions for: rules CRUD, spotlights CRUD, digests CRUD, reports CRUD, OPML import/export, filters dedup status

---

## Task 5: Frontend — AutomateView Full Rewrite

**Files:**
- Rewrite: `src/v2/components/AutomateView.tsx`

6 sections, each with: list of items, create/edit modal, delete confirm, toggle enable/disable. Rule editor with condition tree builder (AND/OR/NOT groups + field/op/value rows). Spotlight color picker. Digest frequency selector. OPML file upload. Reports generate button.

---

## Task 6: Integration Test

Start backend + frontend, verify each section works end-to-end.
