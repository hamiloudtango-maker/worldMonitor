/**
 * FilterBar — faceted filter with chips, autocomplete dropdowns.
 *
 * The "Theme" facet uses Intel Models with aliases:
 * selecting "Mergers & Acquisitions" searches for ["M&A", "merger", "acquisition", "rachat"]
 * in article text, instead of just matching a.theme === 'economic'.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import type { Article, Stats } from '@/v2/lib/constants';
import type { CaseData } from '@/v2/lib/api';
import { useFacetModels, articleText, matchesFacet, type FacetChoice } from '@/v2/hooks/useFacetModels';

// ── Types ───────────────────────────────────────────────────────

export interface ActiveFilters {
  q: string;
  /** Intel Model IDs — matched via keywords+aliases */
  models: string[];
  cases: string[];
}

export const EMPTY_FILTERS: ActiveFilters = { q: '', models: [], cases: [] };

// Backward compat — some components still use 'themes'
/** @deprecated use models */
export type { ActiveFilters as ActiveFiltersCompat };

interface Props {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  stats: Stats | null;
  articles: Article[];
  cases: CaseData[];
}

// ── Chip colors ─────────────────────────────────────────────────

const FACET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  model:   { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  case_:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

// ── Dropdown ────────────────────────────────────────────────────

function Dropdown({ label, items, selected, onToggle, color, icon }: {
  label: string;
  items: { value: string; label: string; count?: number; group?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  color: { bg: string; text: string; border: string };
  icon?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = items.filter(i =>
    i.label.toLowerCase().includes(search.toLowerCase()) || i.value.toLowerCase().includes(search.toLowerCase())
  );

  // Group items by their group field (if present)
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const g = item.group || '';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    }
    return map;
  }, [filtered]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg border transition-all ${
          selected.length > 0 ? `${color.bg} ${color.text} ${color.border}` : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
        }`}
      >
        {icon && <span className="text-[10px]">{icon}</span>}
        {label}
        {selected.length > 0 && <span className="ml-0.5 text-[9px] font-bold opacity-60">{selected.length}</span>}
        <ChevronDown size={10} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="absolute top-8 left-0 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Filtrer ${label.toLowerCase()}...`}
                className="w-full pl-7 pr-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#42d3a5]"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="py-3 text-center text-[10px] text-slate-400">Aucun resultat</div>
            )}
            {[...groups.entries()].map(([group, groupItems]) => (
              <div key={group}>
                {group && (
                  <div className="px-2 pt-2 pb-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">{group}</div>
                )}
                {groupItems.map(item => {
                  const active = selected.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      onClick={() => onToggle(item.value)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[11px] transition-colors ${
                        active ? `${color.bg} ${color.text} font-semibold` : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        active ? `${color.border} ${color.bg}` : 'border-slate-300'
                      }`}>
                        {active && <span className="text-[8px]">&#10003;</span>}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="text-[9px] text-slate-400 font-mono">{item.count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FilterBar ──────────────────────────────────────────────

export default function FilterBar({ filters, onChange, stats, articles, cases }: Props) {
  const { choices, byFamily, countMatches } = useFacetModels();

  // Compute article match counts for Intel Models (cached per articles)
  const modelCounts = useMemo(() => countMatches(articles), [articles, countMatches]);

  // Intel Model options — grouped by family
  const modelOptions = useMemo(() => {
    const items: { value: string; label: string; count?: number; group?: string }[] = [];
    for (const [, { label: famLabel, choices: famChoices }] of byFamily) {
      const sorted = [...famChoices].sort((a, b) => (modelCounts.get(b.id) || 0) - (modelCounts.get(a.id) || 0));
      for (const c of sorted) {
        const count = modelCounts.get(c.id) || 0;
        items.push({ value: c.id, label: c.label, count, group: famLabel });
      }
    }
    return items;
  }, [byFamily, modelCounts]);

  const caseOptions = cases.map(c => ({ value: c.name, label: c.name, count: c.article_count }));

  function toggle(key: keyof ActiveFilters, value: string) {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...filters, [key]: next });
  }

  function removeChip(key: keyof ActiveFilters, value: string) {
    onChange({ ...filters, [key]: (filters[key] as string[]).filter(v => v !== value) });
  }

  // Lookup for model ID → label (for chips)
  const modelLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choices) m.set(c.id, c.label);
    return m;
  }, [choices]);

  const hasFilters = filters.q || filters.models.length || filters.cases.length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
        <input
          value={filters.q}
          onChange={e => onChange({ ...filters, q: e.target.value })}
          placeholder="Rechercher..."
          className="w-44 pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] outline-none focus:border-[#42d3a5] focus:ring-1 focus:ring-[#42d3a5]/20 transition-all"
        />
      </div>

      {/* Facet dropdowns */}
      <Dropdown label="Intel Models" items={modelOptions} selected={filters.models} onToggle={v => toggle('models', v)} color={FACET_COLORS.model!} />
      <Dropdown label="Case" items={caseOptions} selected={filters.cases} onToggle={v => toggle('cases', v)} color={FACET_COLORS.case_!} />

      {/* Active chips */}
      {filters.models.map(id => (
        <span key={`m-${id}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          {modelLabelMap.get(id) || id}
          <button onClick={() => removeChip('models', id)} className="hover:text-purple-900"><X size={10} /></button>
        </span>
      ))}
      {filters.cases.map(c => (
        <span key={`cs-${c}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {c}
          <button onClick={() => removeChip('cases', c)} className="hover:text-emerald-900"><X size={10} /></button>
        </span>
      ))}

      {/* Clear all */}
      {hasFilters && (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
          <X size={10} /> Effacer
        </button>
      )}
    </div>
  );
}
