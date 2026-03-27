# AI Feed Creation UX — Feedly-Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simple text-input feed creation with a Feedly-style multi-step creation flow: tabs → templates → query builder → preview + sources.

**Architecture:** New `FeedCreator` component replaces the empty-state in `AIFeedsView`. Three visual states: (1) template selection with tabs/search/grid, (2) query refinement with AND chip builder, (3) full builder with preview + sources. Existing `QueryBuilder` is rewritten to use Feedly-style chips with inline OR/AND/NOT instead of card-based layers.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide icons. No new dependencies.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/v2/components/ai-feeds/feed-templates.ts` | Template definitions, tab configs, dropdown categories |
| Create | `src/v2/components/ai-feeds/FeedCreator.tsx` | Main creation flow — 3-state wizard |
| Create | `src/v2/components/ai-feeds/TemplateGrid.tsx` | 2×2 template cards with chip previews |
| Create | `src/v2/components/ai-feeds/ChipQueryBuilder.tsx` | Feedly-style chip query builder (AND/OR/NOT inline) |
| Modify | `src/v2/components/AIFeedsView.tsx` | Wire creation flow, add `creating` state |
| Modify | `src/v2/components/ai-feeds/FeedList.tsx` | "Create AI Feed" button triggers creation mode |

Existing files kept unchanged: `FeedPreview.tsx`, `SourceSelector.tsx`, `ai-feeds-api.ts`, `QueryBuilder.tsx` (kept for editing existing feeds).

---

### Task 1: Template Definitions

**Files:**
- Create: `src/v2/components/ai-feeds/feed-templates.ts`

- [ ] **Step 1: Create template data file**

```typescript
// src/v2/components/ai-feeds/feed-templates.ts
import type { QueryLayer } from '@/v2/lib/ai-feeds-api';

export interface FeedTemplate {
  id: string;
  name: string;
  chip1: { label: string; type: 'topic' | 'entity' | 'keyword'; icon: string };
  chip2: { label: string; type: 'topic' | 'entity' | 'keyword'; icon: string; placeholder: string };
}

export interface TabConfig {
  id: string;
  label: string;
  icon: 'strategy' | 'cyber';
  searchPlaceholder: string;
  templates: FeedTemplate[];
  dropdownCategories: DropdownCategory[];
}

export interface DropdownCategory {
  label: string;
  icon: string;
  type: 'suggested' | 'model';
  items?: DropdownItem[];
  hasSubmenu?: boolean;
}

export interface DropdownItem {
  label: string;
  description?: string;
  icon?: string;
}

export const TABS: TabConfig[] = [
  {
    id: 'strategic',
    label: 'Veille Stratégique',
    icon: 'strategy',
    searchPlaceholder: 'Rechercher un sujet, une région, un secteur ou un acteur...',
    templates: [
      {
        id: 'conflicts',
        name: 'Conflits & Crises',
        chip1: { label: 'Conflits armés', type: 'topic', icon: 'swords' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone à surveiller' },
      },
      {
        id: 'diplomacy',
        name: 'Diplomatie & Sanctions',
        chip1: { label: 'Sanctions', type: 'topic', icon: 'gavel' },
        chip2: { label: 'Pays', type: 'entity', icon: 'flag', placeholder: 'Choisir le pays ou l\'entité' },
      },
      {
        id: 'energy',
        name: 'Énergie & Ressources',
        chip1: { label: 'Énergie', type: 'topic', icon: 'zap' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone ou le secteur' },
      },
      {
        id: 'economy',
        name: 'Économie & M&A',
        chip1: { label: 'M&A', type: 'topic', icon: 'trending-up' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur à surveiller' },
      },
    ],
    dropdownCategories: [
      {
        label: 'Région / Pays',
        icon: 'globe',
        type: 'suggested',
        hasSubmenu: true,
        items: [
          { label: 'Moyen-Orient', description: 'Iran, Irak, Syrie, Liban, Yémen...' },
          { label: 'Asie-Pacifique', description: 'Chine, Japon, Corées, Taïwan, ASEAN...' },
          { label: 'Afrique subsaharienne', description: 'Sahel, Corne de l\'Afrique, Grands Lacs...' },
          { label: 'Europe de l\'Est', description: 'Ukraine, Russie, Biélorussie, Moldavie...' },
          { label: 'Amérique latine', description: 'Venezuela, Colombie, Brésil, Mexique...' },
        ],
      },
      { label: 'Organisations internationales', icon: 'landmark', type: 'model' },
      { label: 'Secteurs industriels', icon: 'factory', type: 'model', hasSubmenu: true },
      { label: 'Matières premières', icon: 'gem', type: 'model' },
      { label: 'Acteurs étatiques', icon: 'crown', type: 'model' },
      { label: 'Technologies', icon: 'cpu', type: 'model', hasSubmenu: true },
      { label: 'Climat & Environnement', icon: 'cloud-sun', type: 'model' },
    ],
  },
  {
    id: 'cyber',
    label: 'Veille Cyber',
    icon: 'cyber',
    searchPlaceholder: 'Rechercher un acteur, une vulnérabilité ou un sujet cyber...',
    templates: [
      {
        id: 'ransomware',
        name: 'Ransomware & Malware',
        chip1: { label: 'Ransomware', type: 'topic', icon: 'bug' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur ciblé' },
      },
      {
        id: 'apt',
        name: 'APT & Acteurs',
        chip1: { label: 'Threat Actor', type: 'topic', icon: 'skull' },
        chip2: { label: 'Région', type: 'entity', icon: 'globe', placeholder: 'Choisir la zone d\'origine' },
      },
      {
        id: 'vulns',
        name: 'Vulnérabilités Critiques',
        chip1: { label: 'Vulnérabilité haute', type: 'topic', icon: 'alert-triangle' },
        chip2: { label: 'Technologie', type: 'entity', icon: 'cpu', placeholder: 'Choisir la technologie affectée' },
      },
      {
        id: 'breaches',
        name: 'Data Breaches',
        chip1: { label: 'Data Breach', type: 'topic', icon: 'database' },
        chip2: { label: 'Secteur', type: 'entity', icon: 'building', placeholder: 'Choisir le secteur impacté' },
      },
    ],
    dropdownCategories: [
      {
        label: 'Secteur',
        icon: 'building',
        type: 'suggested',
        hasSubmenu: true,
        items: [
          { label: 'Finance & Banque', description: 'Banques, assurances, fintech...' },
          { label: 'Santé', description: 'Hôpitaux, pharma, biotech...' },
          { label: 'Énergie', description: 'Utilities, pétrole, nucléaire...' },
          { label: 'Défense & Aéro', description: 'Armement, spatial, aéronautique...' },
          { label: 'Tech & Telecom', description: 'GAFAM, telecom, cloud...' },
        ],
      },
      { label: 'Threat Actors', icon: 'skull', type: 'model', hasSubmenu: true },
      { label: 'Malware', icon: 'bug', type: 'model', hasSubmenu: true },
      { label: 'Technologies', icon: 'cpu', type: 'model', hasSubmenu: true },
      { label: 'Frameworks (MITRE)', icon: 'shield', type: 'model' },
      { label: 'Régions d\'origine', icon: 'globe', type: 'model', hasSubmenu: true },
    ],
  },
];

/** Convert template selection into a FeedQuery for the existing API */
export function templateToQuery(
  template: FeedTemplate,
  chip2Value: string,
): { layers: QueryLayer[] } {
  return {
    layers: [
      {
        operator: 'AND',
        parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }],
      },
      {
        operator: 'AND',
        parts: [{ type: template.chip2.type, value: chip2Value, scope: 'title_and_content' }],
      },
    ],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/ai-feeds/feed-templates.ts
git commit -m "feat(ai-feeds): add Feedly-style template definitions for creation flow"
```

---

### Task 2: Template Grid Component

**Files:**
- Create: `src/v2/components/ai-feeds/TemplateGrid.tsx`

- [ ] **Step 1: Create TemplateGrid component**

This is the 2×2 grid of clickable template cards shown on the initial creation screen. Each card shows the template name, then two chips connected by "AND" — exactly like Feedly.

```tsx
// src/v2/components/ai-feeds/TemplateGrid.tsx
import { Sparkles } from 'lucide-react';
import type { FeedTemplate } from './feed-templates';

interface Props {
  templates: FeedTemplate[];
  onSelect: (template: FeedTemplate) => void;
}

export default function TemplateGrid({ templates, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-600 mb-3">Commencer avec un template</h2>
      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="text-left p-4 rounded-xl border border-slate-200 hover:border-[#42d3a5]/40 hover:shadow-sm transition-all group"
          >
            <div className="text-[13px] font-semibold text-slate-700 mb-3">{t.name}</div>
            <div className="space-y-1.5">
              {/* Chip 1 */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <Sparkles size={12} className="text-[#42d3a5]" />
                <span className="text-[11px] font-medium text-slate-700">{t.chip1.label}</span>
                <span className="text-[8px] font-bold text-[#42d3a5] bg-[#42d3a5]/10 px-1 py-0.5 rounded">AI</span>
              </div>
              {/* AND separator */}
              <div className="text-[10px] font-semibold text-slate-400 pl-2">AND</div>
              {/* Chip 2 */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
                <Sparkles size={12} className="text-[#42d3a5]" />
                <span className="text-[11px] font-medium text-slate-700">{t.chip2.label}</span>
                <span className="text-[8px] font-bold text-[#42d3a5] bg-[#42d3a5]/10 px-1 py-0.5 rounded">AI</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/ai-feeds/TemplateGrid.tsx
git commit -m "feat(ai-feeds): add TemplateGrid component — 2x2 cards with chip previews"
```

---

### Task 3: Chip Query Builder (Feedly-style)

**Files:**
- Create: `src/v2/components/ai-feeds/ChipQueryBuilder.tsx`

- [ ] **Step 1: Create ChipQueryBuilder component**

This replaces the card-based QueryBuilder for the creation flow. Matches Feedly exactly: chip rows with `x` remove, `+ OR` button, `AND` separator between rows, `Find in Title & Content` dropdown, trash icon, `+ AND` / `— NOT` buttons at the bottom.

```tsx
// src/v2/components/ai-feeds/ChipQueryBuilder.tsx
import { useState } from 'react';
import { X, Trash2, ChevronDown, Plus, Minus, Filter } from 'lucide-react';
import type { FeedQuery, QueryLayer, QueryPart } from '@/v2/lib/ai-feeds-api';

interface Props {
  query: FeedQuery;
  onChange: (query: FeedQuery) => void;
}

const SCOPE_OPTIONS = [
  { value: 'title_and_content', label: 'Titre & Contenu' },
  { value: 'title', label: 'Titre uniquement' },
] as const;

export default function ChipQueryBuilder({ query, onChange }: Props) {
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [newValue, setNewValue] = useState('');

  function updateLayer(idx: number, layer: QueryLayer) {
    const updated = [...query.layers];
    updated[idx] = layer;
    onChange({ layers: updated });
  }

  function removeLayer(idx: number) {
    onChange({ layers: query.layers.filter((_, i) => i !== idx) });
  }

  function removePart(layerIdx: number, partIdx: number) {
    const layer = query.layers[layerIdx]!;
    const parts = layer.parts.filter((_, i) => i !== partIdx);
    if (parts.length === 0) {
      removeLayer(layerIdx);
    } else {
      updateLayer(layerIdx, { ...layer, parts });
    }
  }

  function addPartToLayer(layerIdx: number, value: string) {
    if (!value.trim()) return;
    const layer = query.layers[layerIdx]!;
    const newPart: QueryPart = { type: 'keyword', value: value.trim(), scope: 'title_and_content' };
    updateLayer(layerIdx, { ...layer, parts: [...layer.parts, newPart] });
    setNewValue('');
    setAddingTo(null);
  }

  function addLayer(operator: 'AND' | 'NOT') {
    onChange({
      layers: [...query.layers, { operator, parts: [] }],
    });
  }

  function updateScope(layerIdx: number, scope: QueryPart['scope']) {
    const layer = query.layers[layerIdx]!;
    updateLayer(layerIdx, {
      ...layer,
      parts: layer.parts.map(p => ({ ...p, scope })),
    });
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-600 mb-3">Filtres</h2>

      <div className="space-y-0">
        {query.layers.map((layer, li) => (
          <div key={li}>
            {/* Operator separator between layers */}
            {li > 0 && (
              <div className="py-1.5 text-[11px] font-bold text-slate-400">{layer.operator}</div>
            )}

            {/* Layer row */}
            <div className="flex items-center gap-2 py-1.5">
              {/* Chips */}
              <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                {layer.parts.map((part, pi) => (
                  <div
                    key={pi}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <Filter size={11} className="text-[#42d3a5]" />
                    <span className="text-[11px] font-medium text-slate-700">{part.value}</span>
                    <button
                      onClick={() => removePart(li, pi)}
                      className="p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}

                {/* Inline add (+ OR) */}
                {addingTo === li ? (
                  <input
                    autoFocus
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addPartToLayer(li, newValue);
                      if (e.key === 'Escape') { setAddingTo(null); setNewValue(''); }
                    }}
                    onBlur={() => { if (newValue.trim()) addPartToLayer(li, newValue); else { setAddingTo(null); setNewValue(''); } }}
                    placeholder="Ajouter un filtre..."
                    className="px-2.5 py-1 text-[11px] border border-[#42d3a5] rounded-lg focus:outline-none w-36"
                  />
                ) : (
                  <button
                    onClick={() => setAddingTo(li)}
                    className="text-[11px] font-semibold text-[#42d3a5] hover:text-[#38b891] flex items-center gap-0.5"
                  >
                    <Plus size={11} /> OR
                  </button>
                )}
              </div>

              {/* Scope dropdown */}
              <div className="relative shrink-0">
                <select
                  value={layer.parts[0]?.scope || 'title_and_content'}
                  onChange={e => updateScope(li, e.target.value as QueryPart['scope'])}
                  className="appearance-none text-[10px] text-slate-500 pr-5 pl-2 py-1 border border-slate-200 rounded-lg bg-white cursor-pointer focus:outline-none focus:border-[#42d3a5]"
                >
                  {SCOPE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Delete layer */}
              <button
                onClick={() => removeLayer(li)}
                className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add AND / NOT buttons */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => addLayer('AND')}
          className="text-[11px] font-semibold text-[#42d3a5] hover:text-[#38b891] flex items-center gap-0.5"
        >
          <Plus size={11} /> AND
        </button>
        <span className="text-slate-300">/</span>
        <button
          onClick={() => addLayer('NOT')}
          className="text-[11px] font-semibold text-[#42d3a5] hover:text-[#38b891] flex items-center gap-0.5"
        >
          <Minus size={11} /> NOT
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/ai-feeds/ChipQueryBuilder.tsx
git commit -m "feat(ai-feeds): add ChipQueryBuilder — Feedly-style chips with inline AND/OR/NOT"
```

---

### Task 4: FeedCreator — Main Creation Flow

**Files:**
- Create: `src/v2/components/ai-feeds/FeedCreator.tsx`

- [ ] **Step 1: Create FeedCreator component**

This is the main wizard component with 3 states, exactly like Feedly:
1. `browse` — tabs + search + template grid
2. `refine` — chip1 pre-filled, AND input for chip2 with dropdown + Skip/Clear
3. `build` — full query builder + preview + sources + Save/Clear header

```tsx
// src/v2/components/ai-feeds/FeedCreator.tsx
import { useState, useRef, useEffect } from 'react';
import { Search, Filter, TrendingUp, Shield, ChevronRight, Sparkles, X } from 'lucide-react';
import { TABS, templateToQuery } from './feed-templates';
import type { FeedTemplate, TabConfig, DropdownCategory } from './feed-templates';
import type { FeedQuery } from '@/v2/lib/ai-feeds-api';
import TemplateGrid from './TemplateGrid';
import ChipQueryBuilder from './ChipQueryBuilder';
import FeedPreview from './FeedPreview';
import SourceSelector from './SourceSelector';

type CreationState =
  | { step: 'browse' }
  | { step: 'refine'; template: FeedTemplate }
  | { step: 'build' };

interface Props {
  onSave: (name: string, query: FeedQuery) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export default function FeedCreator({ onSave, onCancel, saving }: Props) {
  const [activeTab, setActiveTab] = useState<string>(TABS[0]!.id);
  const [state, setState] = useState<CreationState>({ step: 'browse' });
  const [searchValue, setSearchValue] = useState('');
  const [query, setQuery] = useState<FeedQuery>({ layers: [] });
  const [feedName, setFeedName] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tab = TABS.find(t => t.id === activeTab) || TABS[0]!;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleTemplateSelect(template: FeedTemplate) {
    // Pre-fill chip1, go to refine step for chip2
    setQuery({
      layers: [
        { operator: 'AND', parts: [{ type: template.chip1.type, value: template.chip1.label, scope: 'title_and_content' }] },
      ],
    });
    setFeedName(template.name);
    setState({ step: 'refine', template });
  }

  function handleSearchSubmit() {
    if (!searchValue.trim()) return;
    setQuery({
      layers: [
        { operator: 'AND', parts: [{ type: 'keyword', value: searchValue.trim(), scope: 'title_and_content' }] },
      ],
    });
    setFeedName(searchValue.trim());
    setState({ step: 'build' });
    setSearchValue('');
  }

  function handleRefineSelect(value: string) {
    // Add chip2 to query and go to build step
    setQuery(prev => ({
      layers: [
        ...prev.layers,
        { operator: 'AND', parts: [{ type: 'entity', value, scope: 'title_and_content' }] },
      ],
    }));
    setShowDropdown(false);
    setState({ step: 'build' });
  }

  function handleRefineSkip() {
    setState({ step: 'build' });
  }

  function handleClear() {
    setState({ step: 'browse' });
    setQuery({ layers: [] });
    setFeedName('');
    setSearchValue('');
  }

  async function handleSave() {
    const name = feedName || `Feed ${new Date().toLocaleDateString('fr-FR')}`;
    await onSave(name, query);
  }

  // ── STEP: Browse (tabs + search + templates) ──
  if (state.step === 'browse') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900">AI Feed</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
          <h1 className="text-lg font-semibold text-slate-700 italic mb-4">Collecter articles et rapports</h1>

          {/* Tabs */}
          <div className="flex items-center gap-4 mb-5 border-b border-slate-100 pb-3">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors pb-1 ${
                  activeTab === t.id
                    ? 'text-slate-900 border-b-2 border-[#42d3a5]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.icon === 'strategy' ? <TrendingUp size={14} /> : <Shield size={14} />}
                {t.label}
              </button>
            ))}
          </div>

          {/* Filters section */}
          <h2 className="text-sm font-semibold text-slate-600 mb-2">Filtres</h2>

          {/* Search bar */}
          <div className="relative mb-6">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              placeholder={tab.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white"
            />
          </div>

          {/* Templates */}
          <TemplateGrid templates={tab.templates} onSelect={handleTemplateSelect} />
        </div>
      </div>
    );
  }

  // ── STEP: Refine (chip1 filled, choose chip2) ──
  if (state.step === 'refine') {
    const template = state.template;
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-base font-bold text-slate-900">AI Feed</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
          <h1 className="text-lg font-semibold text-slate-700 italic mb-4">Collecter articles et rapports</h1>

          {/* Tabs (read-only at this step) */}
          <div className="flex items-center gap-4 mb-5 border-b border-slate-100 pb-3">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 text-[12px] font-medium transition-colors pb-1 ${
                  activeTab === t.id
                    ? 'text-slate-900 border-b-2 border-[#42d3a5]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {t.icon === 'strategy' ? <TrendingUp size={14} /> : <Shield size={14} />}
                {t.label}
              </button>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-slate-600 mb-3">Filtres</h2>

          {/* Chip 1 (pre-filled) */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">
              <Sparkles size={11} className="text-[#42d3a5]" />
              <span className="text-[11px] font-medium text-slate-700">{template.chip1.label}</span>
              <button
                onClick={handleClear}
                className="p-0.5 text-slate-400 hover:text-red-500"
              >
                <X size={11} />
              </button>
            </div>
            <button className="text-[11px] font-semibold text-[#42d3a5] flex items-center gap-0.5">
              + OR
            </button>
          </div>

          {/* AND separator */}
          <div className="text-[11px] font-bold text-slate-400 py-1.5">AND</div>

          {/* Chip 2 input with dropdown */}
          <div className="relative mb-4" ref={dropdownRef}>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                value={searchValue}
                onChange={e => { setSearchValue(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchValue.trim()) {
                    handleRefineSelect(searchValue.trim());
                  }
                }}
                placeholder={template.chip2.placeholder}
                className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] bg-white"
              />
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                {tab.dropdownCategories.map((cat, i) => (
                  <div key={i}>
                    {i === 0 && (
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Suggéré</div>
                    )}
                    {i === 1 && (
                      <div className="px-3 pt-3 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Modèles AI</div>
                    )}
                    {cat.items ? (
                      // Category with inline items
                      cat.items
                        .filter(item => !searchValue || item.label.toLowerCase().includes(searchValue.toLowerCase()))
                        .map((item, j) => (
                          <button
                            key={j}
                            onClick={() => handleRefineSelect(item.label)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                          >
                            <Search size={13} className="text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-medium text-slate-700">{item.label}</div>
                              {item.description && (
                                <div className="text-[10px] text-slate-400 truncate">{item.description}</div>
                              )}
                            </div>
                            {cat.hasSubmenu && <ChevronRight size={13} className="text-slate-300" />}
                          </button>
                        ))
                    ) : (
                      // Category as direct option
                      <button
                        onClick={() => handleRefineSelect(cat.label)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                      >
                        <Search size={13} className="text-slate-400 shrink-0" />
                        <span className="text-[12px] font-medium text-slate-700">{cat.label}</span>
                        {cat.hasSubmenu && <ChevronRight size={13} className="text-slate-300" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Skip / Clear buttons */}
          <div className="flex items-center gap-3">
            <button onClick={handleRefineSkip} className="text-[12px] font-medium text-slate-500 hover:text-slate-700">
              Passer
            </button>
            <button onClick={handleClear} className="text-[12px] font-medium text-slate-500 hover:text-slate-700">
              Effacer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: Build (full query + preview + sources) ──
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with Save / Clear */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h1 className="text-base font-bold text-slate-900">AI Feed</h1>
        <div className="flex items-center gap-3">
          <button onClick={handleClear} className="text-[12px] font-medium text-slate-500 hover:text-slate-700">
            Effacer
          </button>
          <button
            onClick={handleSave}
            disabled={saving || query.layers.length === 0}
            className="px-4 py-1.5 text-[12px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Création...' : 'Sauvegarder AI Feed'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: query + preview */}
        <div className="flex-1 overflow-y-auto p-6">
          <h1 className="text-lg font-semibold text-slate-700 italic mb-4">Collecter articles et rapports</h1>

          <ChipQueryBuilder query={query} onChange={setQuery} />

          {/* Preview section */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <FeedPreview feedId={null} />
          </div>
        </div>

        {/* Right: sources */}
        <div className="w-72 shrink-0 border-l border-slate-200/60 bg-white">
          <SourceSelector feedId={null} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/v2/components/ai-feeds/FeedCreator.tsx
git commit -m "feat(ai-feeds): add FeedCreator — 3-step Feedly-style creation wizard"
```

---

### Task 5: Wire FeedCreator into AIFeedsView

**Files:**
- Modify: `src/v2/components/AIFeedsView.tsx`
- Modify: `src/v2/components/ai-feeds/FeedList.tsx`

- [ ] **Step 1: Update AIFeedsView to use FeedCreator**

Replace the empty state (lines 136-155) with FeedCreator. Add `creating` boolean state. When `creating` is true, show FeedCreator instead of the empty state. FeedCreator's `onSave` creates the feed via API + bootstrap, then switches to the edit view.

In `AIFeedsView.tsx`, replace the entire component with:

```tsx
// src/v2/components/AIFeedsView.tsx
import { useState } from 'react';
import { useAIFeeds } from '@/v2/hooks/useAIFeeds';
import type { AIFeedData, FeedQuery } from '@/v2/lib/ai-feeds-api';
import { bootstrapFeed, addFeedSource } from '@/v2/lib/ai-feeds-api';
import FeedList from './ai-feeds/FeedList';
import QueryBuilder from './ai-feeds/QueryBuilder';
import SourceSelector from './ai-feeds/SourceSelector';
import FeedPreview from './ai-feeds/FeedPreview';
import FeedCreator from './ai-feeds/FeedCreator';

export default function AIFeedsView() {
  const { feeds, add, remove, update } = useAIFeeds();
  const [selected, setSelected] = useState<AIFeedData | null>(null);
  const [localQuery, setLocalQuery] = useState<FeedQuery>({ layers: [] });
  const [dirty, setDirty] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sourceKey, setSourceKey] = useState(0);
  const [creating, setCreating] = useState(false);

  function handleSelect(feed: AIFeedData) {
    setSelected(feed);
    setLocalQuery(feed.query || { layers: [] });
    setDirty(false);
    setCreating(false);
  }

  function handleQueryChange(query: FeedQuery) {
    setLocalQuery(query);
    setDirty(true);
  }

  function handleStartCreate() {
    setSelected(null);
    setCreating(true);
  }

  async function handleCreateFromWizard(name: string, query: FeedQuery) {
    setBootstrapping(true);
    try {
      // Create feed with the wizard-built query
      const feed = await add(name, '', query);

      // Bootstrap to get AI-suggested sources
      const bootstrap = await bootstrapFeed(name);

      if (bootstrap.resolved_sources?.length && feed.id) {
        const addPromises = bootstrap.resolved_sources.map(s =>
          addFeedSource(feed.id, {
            url: s.url, name: s.name, lang: s.lang ?? undefined,
            tier: s.tier, source_type: s.source_type ?? undefined,
            country: s.country ?? undefined, continent: s.continent ?? undefined,
            origin: 'ai_suggested',
          }).catch(() => null)
        );
        await Promise.all(addPromises);
      }

      if (bootstrap.description) {
        await update(feed.id, { description: bootstrap.description });
      }

      setLocalQuery(query);
      setSelected({ ...feed, source_count: bootstrap.resolved_sources?.length || 0 });
      setDirty(false);
      setCreating(false);
      setSourceKey(k => k + 1);
    } catch {
      const feed = await add(name, '', query);
      handleSelect(feed);
    }
    setBootstrapping(false);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (selected?.id === id) {
      setSelected(null);
      setLocalQuery({ layers: [] });
    }
  }

  async function handleSave() {
    if (!selected || !dirty) return;
    const updated = await update(selected.id, { query: localQuery });
    setSelected(updated);
    setDirty(false);
  }

  return (
    <div className="flex h-full -m-5 bg-white rounded-xl border border-slate-200/60 overflow-hidden">
      {/* Left: Feed list */}
      <FeedList
        feeds={feeds}
        selectedId={selected?.id || null}
        bootstrapping={bootstrapping}
        onSelect={handleSelect}
        onCreate={handleStartCreate}
        onDelete={handleDelete}
      />

      {/* Center + Right: creation wizard or edit view */}
      {creating ? (
        <FeedCreator
          onSave={handleCreateFromWizard}
          onCancel={() => setCreating(false)}
          saving={bootstrapping}
        />
      ) : selected ? (
        <>
          {/* Center: Query builder + Preview */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200/60">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{selected.name}</h2>
                <p className="text-[10px] text-slate-400">
                  {selected.source_count} sources · {selected.result_count} articles · {selected.status}
                  {selected.description && <span className="ml-1">— {selected.description}</span>}
                </p>
              </div>
              {dirty && (
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 text-[11px] font-semibold text-white rounded-lg shadow-sm transition-colors"
                  style={{ background: '#42d3a5' }}
                >
                  Sauvegarder
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <QueryBuilder query={localQuery} onChange={handleQueryChange} />
              <div className="border-t border-slate-100 pt-4">
                <FeedPreview feedId={selected.id} />
              </div>
            </div>
          </div>

          {/* Right: Source selector */}
          <div className="w-80 shrink-0 bg-white">
            <SourceSelector key={sourceKey} feedId={selected.id} />
          </div>
        </>
      ) : (
        /* Empty state — prompt to create */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-50 to-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#42d3a5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">AI Feeds</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Créez un feed intelligent pour surveiller les sujets qui comptent. L'IA configure automatiquement vos filtres et sources.
            </p>
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 text-[12px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] transition-colors"
            >
              Créer un AI Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update FeedList to call onCreate without a name**

In `FeedList.tsx`, change the Props interface and simplify the create button to just trigger the creation mode (no text input needed — the wizard handles naming).

Replace `FeedList.tsx` `Props.onCreate` from `(name: string) => Promise<void>` to `() => void`, and replace the create input section (lines 53-77) with a simple "Create AI Feed" button:

```tsx
// In FeedList.tsx, change:
// Old: onCreate: (name: string) => Promise<void>;
// New:
onCreate: () => void;

// Replace lines 54-77 (the create input + bootstrapping banner) with:
<button
  onClick={() => onCreate()}
  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#42d3a5]/10 text-[#2a9d7e] hover:bg-[#42d3a5]/20 transition-colors"
>
  <Sparkles size={14} />
  <span className="text-[11px] font-semibold">Créer un AI Feed</span>
</button>
```

Remove the `newName` state, `handleCreate` function, and the `Loader2` import if no longer used.

- [ ] **Step 3: Verify app compiles**

Run: `npm run build 2>&1 | head -30`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/v2/components/AIFeedsView.tsx src/v2/components/ai-feeds/FeedList.tsx
git commit -m "feat(ai-feeds): wire FeedCreator wizard into main view + simplify FeedList create button"
```

---

### Task 6: Polish & Visual Alignment

**Files:**
- Modify: `src/v2/components/ai-feeds/FeedCreator.tsx`
- Modify: `src/v2/components/ai-feeds/TemplateGrid.tsx`

- [ ] **Step 1: Visual polish pass**

After the functional integration, review the creation flow in the browser and adjust:
- Template card spacing and hover states to match Feedly's rounded cards with subtle border
- Search bar height and padding to match Feedly's proportions
- Tab underline active state
- Dropdown shadow and border radius
- Chip styling (green AI badge)
- AND/OR/NOT text sizing and weight
- "Save AI Feed" button matches Feedly's green CTA

- [ ] **Step 2: Test the full flow**

1. Click "Créer un AI Feed" in sidebar → should see tabs + templates
2. Click a template card → should see chip1 + AND + search input with dropdown
3. Select from dropdown → should see full builder with chips + preview + sources
4. Click "Sauvegarder AI Feed" → should create feed and switch to edit view
5. Use search bar directly (skip templates) → should go straight to build step

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(ai-feeds): polish Feedly-style creation flow — visual alignment & UX"
```
