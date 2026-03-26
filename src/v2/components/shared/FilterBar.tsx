/**
 * FilterBar — faceted filter with chips, autocomplete dropdowns.
 * Replaces the basic search bar in the Dashboard header.
 * Filters: country, theme, threat level, source, free text.
 */
import { useState, useRef, useEffect } from 'react';
import { Search, X, Filter, ChevronDown } from 'lucide-react';
import type { Article, Stats } from '@/v2/lib/constants';
import { capitalize, FLAGS } from '@/v2/lib/constants';
import type { CaseData } from '@/v2/lib/api';

// ── Types ───────────────────────────────────────────────────────

export interface ActiveFilters {
  q: string;
  countries: string[];
  themes: string[];
  threats: string[];
  cases: string[]; // case names
}

export const EMPTY_FILTERS: ActiveFilters = { q: '', countries: [], themes: [], threats: [], cases: [] };

interface Props {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  stats: Stats | null;
  articles: Article[];
  cases: CaseData[];
}

// ── Chip colors ─────────────────────────────────────────────────

const FACET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  country: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  theme:   { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  threat:  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  case_:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};

const THREAT_LEVELS = ['critical', 'high', 'medium', 'low', 'info'];

// ── Dropdown ────────────────────────────────────────────────────

function Dropdown({ label, items, selected, onToggle, color, icon }: {
  label: string;
  items: { value: string; label: string; count?: number }[];
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
        <ChevronDown size={10} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div className="absolute top-8 left-0 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          {/* Search */}
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

          {/* Items */}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="py-3 text-center text-[10px] text-slate-400">Aucun resultat</div>
            )}
            {filtered.map(item => {
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
                  {item.count !== undefined && (
                    <span className="text-[9px] text-slate-400 font-mono">{item.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FilterBar ──────────────────────────────────────────────

export default function FilterBar({ filters, onChange, stats, articles, cases }: Props) {
  // Compute available options from data
  const countryOptions = (() => {
    const counts: Record<string, number> = {};
    for (const a of articles) {
      for (const c of a.country_codes) counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({
        value: code,
        label: `${FLAGS[code] || ''} ${code}`,
        count,
      }));
  })();

  const themeOptions = Object.entries(stats?.by_theme || {})
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => ({ value: t, label: capitalize(t), count: c }));

  const caseOptions = cases.map(c => ({
    value: c.name,
    label: c.name,
    count: c.article_count,
  }));

  const threatOptions = THREAT_LEVELS.map(t => ({
    value: t,
    label: capitalize(t),
    count: stats?.by_threat[t] || 0,
  }));

  function toggle(key: keyof ActiveFilters, value: string) {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
    onChange({ ...filters, [key]: next });
  }

  function removeChip(key: keyof ActiveFilters, value: string) {
    onChange({ ...filters, [key]: (filters[key] as string[]).filter(v => v !== value) });
  }

  const hasFilters = filters.q || filters.countries.length || filters.themes.length || filters.threats.length || filters.cases.length;

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
      <Dropdown label="Pays" items={countryOptions} selected={filters.countries} onToggle={v => toggle('countries', v)} color={FACET_COLORS.country!} />
      <Dropdown label="Theme" items={themeOptions} selected={filters.themes} onToggle={v => toggle('themes', v)} color={FACET_COLORS.theme!} />
      <Dropdown label="Menace" items={threatOptions} selected={filters.threats} onToggle={v => toggle('threats', v)} color={FACET_COLORS.threat!} />
      <Dropdown label="Case" items={caseOptions} selected={filters.cases} onToggle={v => toggle('cases', v)} color={FACET_COLORS.case_!} />

      {/* Active chips */}
      {filters.countries.map(c => (
        <span key={`c-${c}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          {FLAGS[c] || ''} {c}
          <button onClick={() => removeChip('countries', c)} className="hover:text-blue-900"><X size={10} /></button>
        </span>
      ))}
      {filters.themes.map(t => (
        <span key={`t-${t}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          {capitalize(t)}
          <button onClick={() => removeChip('themes', t)} className="hover:text-purple-900"><X size={10} /></button>
        </span>
      ))}
      {filters.threats.map(t => (
        <span key={`th-${t}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
          {capitalize(t)}
          <button onClick={() => removeChip('threats', t)} className="hover:text-red-900"><X size={10} /></button>
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
