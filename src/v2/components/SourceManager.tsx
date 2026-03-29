// src/v2/components/SourceManager.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  X, Loader2,
} from 'lucide-react';
import {
  listSources, updateSource, deleteSource, bulkAction, bulkAddSources,
} from '@/v2/lib/source-manager-api';
import type { CatalogSource } from '@/v2/lib/source-manager-api';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string | null): string {
  if (!iso) return 'jamais';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `il y a ${days}j`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-500',
  degraded: 'bg-yellow-500',
  error: 'bg-red-500',
  disabled: 'bg-slate-300',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  degraded: 'Dégradé',
  error: 'Erreur',
  disabled: 'Désactivé',
};

const CONTINENTS = [
  'Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Asie',
  'Europe', 'Moyen-Orient', 'Océanie', 'Global',
];

type GroupBy = 'none' | 'tags' | 'country';

interface Filters {
  continent?: string;
  country?: string;
  tag?: string;
  tier?: string;
  status?: string;
  q?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SourceManager() {
  /* ---- core state ---- */
  const [sources, setSources] = useState<CatalogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({});
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [editSource, setEditSource] = useState<CatalogSource | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  /* ---- search debounce ---- */
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(f => ({ ...f, q: searchInput || undefined }));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  /* ---- data loading ---- */
  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSources();
      setSources(res.sources);
    } catch (e) {
      console.error('SourceManager: fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  /* ---- derived filter values ---- */
  const distinctValues = useMemo(() => {
    const continents = new Set<string>();
    const countries = new Set<string>();
    const tags = new Set<string>();
    const tiers = new Set<number>();
    for (const s of sources) {
      if (s.continent) continents.add(s.continent);
      if (s.country) countries.add(s.country);
      s.tags.forEach(t => tags.add(t));
      tiers.add(s.tier);
    }
    return {
      continents: [...continents].sort(),
      countries: [...countries].sort(),
      tags: [...tags].sort(),
      tiers: [...tiers].sort(),
    };
  }, [sources]);

  const countriesForContinent = useMemo(() => {
    if (!filters.continent) return distinctValues.countries;
    return [...new Set(
      sources.filter(s => s.continent === filters.continent).map(s => s.country).filter(Boolean) as string[]
    )].sort();
  }, [sources, filters.continent, distinctValues.countries]);

  /* ---- client-side filtering ---- */
  const filtered = useMemo(() => {
    return sources.filter(s => {
      if (filters.continent && s.continent !== filters.continent) return false;
      if (filters.country && s.country !== filters.country) return false;
      if (filters.tag && !s.tags.includes(filters.tag)) return false;
      if (filters.tier && s.tier !== Number(filters.tier)) return false;
      if (filters.status && s.status !== filters.status) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const haystack = `${s.name} ${s.url} ${s.country ?? ''} ${s.tags.join(' ')} ${s.description ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sources, filters]);

  /* ---- collapsed groups ---- */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) =>
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  /* ---- selection helpers ---- */
  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  };

  /* ---- mutations ---- */
  const handleToggleActive = async (s: CatalogSource) => {
    try {
      await updateSource(s.id, { active: !s.active });
      await fetchSources();
    } catch (e) { console.error('toggle failed', e); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette source ? Cette action est irréversible.')) return;
    try {
      await deleteSource(id);
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      await fetchSources();
    } catch (e) { console.error('delete failed', e); }
  };

  const handleBulk = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Supprimer ${selected.size} source(s) ? Cette action est irréversible.`)) return;
    try {
      await bulkAction([...selected], action);
      setSelected(new Set());
      await fetchSources();
    } catch (e) { console.error('bulk action failed', e); }
  };

  const resetFilters = () => {
    setFilters({});
    setSearchInput('');
  };

  /* ---- grouping logic ---- */
  const grouped = useMemo(() => {
    if (groupBy === 'none') return null;

    if (groupBy === 'tags') {
      const map = new Map<string, CatalogSource[]>();
      for (const s of filtered) {
        if (s.tags.length === 0) {
          const list = map.get('Sans tag') ?? [];
          list.push(s);
          map.set('Sans tag', list);
        } else {
          for (const t of s.tags) {
            const list = map.get(t) ?? [];
            list.push(s);
            map.set(t, list);
          }
        }
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }

    // groupBy === 'country' — two-level: continent → country
    const map = new Map<string, Map<string, CatalogSource[]>>();
    for (const s of filtered) {
      const cont = s.continent ?? 'Inconnu';
      const ctry = s.country ?? 'Inconnu';
      if (!map.has(cont)) map.set(cont, new Map());
      const inner = map.get(cont)!;
      if (!inner.has(ctry)) inner.set(ctry, []);
      inner.get(ctry)!.push(s);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cont, inner]) => ({
        continent: cont,
        countries: [...inner.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      }));
  }, [filtered, groupBy]);

  /* ================================================================ */
  /*  Sub-components (inlined)                                         */
  /* ================================================================ */

  /* ---- Row ---- */
  const SourceRow = ({ s }: { s: CatalogSource }) => (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="pl-3 pr-1 py-2">
        <input type="checkbox" checked={selected.has(s.id)}
          onChange={() => toggleOne(s.id)} className="accent-blue-600 rounded" />
      </td>
      <td className="px-2 py-2 max-w-[220px]">
        <span className="truncate block font-medium text-slate-800" title={s.name}>{s.name}</span>
        <span className="text-[11px] text-slate-400 truncate block" title={s.url}>{s.url}</span>
      </td>
      <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{s.country ?? '—'}</td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {s.tags.length === 0 && <span className="text-slate-300 text-xs">—</span>}
          {s.tags.map(t => (
            <span key={t} className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">{t}</span>
          ))}
        </div>
      </td>
      <td className="px-2 py-2">
        <span className="px-1.5 py-0.5 text-xs font-mono rounded bg-slate-100 text-slate-600">T{s.tier}</span>
      </td>
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className={`w-2 h-2 rounded-full inline-block ${STATUS_DOT[s.status] ?? 'bg-slate-300'}`} />
          {STATUS_LABEL[s.status] ?? s.status}
        </span>
      </td>
      <td className="px-2 py-2 text-xs text-slate-500 whitespace-nowrap">{timeAgo(s.last_fetched_at)}</td>
      <td className="px-2 py-2 text-xs">
        <span className={s.fetch_error_count > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'} title={s.last_error || ''}>
          {s.fetch_error_count > 0 ? `${s.fetch_error_count} — ${s.last_error || 'Erreur'}` : '0'}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          {/* Toggle active */}
          <button onClick={() => handleToggleActive(s)}
            title={s.active ? 'Désactiver' : 'Activer'}
            className={`p-1 rounded transition-colors ${s.active ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${s.active ? 'bg-green-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${s.active ? 'left-[18px]' : 'left-0.5'}`} />
            </div>
          </button>
          {/* Edit */}
          <button onClick={() => setEditSource(s)}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Modifier">
            <Pencil size={14} />
          </button>
          {/* Delete */}
          <button onClick={() => handleDelete(s.id)}
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );

  /* ---- Table header ---- */
  const TableHead = () => (
    <thead>
      <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase tracking-wider">
        <th className="pl-3 pr-1 py-2 w-8">
          <input type="checkbox"
            checked={filtered.length > 0 && selected.size === filtered.length}
            onChange={toggleAll} className="accent-blue-600 rounded" />
        </th>
        <th className="px-2 py-2">Nom</th>
        <th className="px-2 py-2">Pays</th>
        <th className="px-2 py-2">Tags</th>
        <th className="px-2 py-2">Tier</th>
        <th className="px-2 py-2">Statut</th>
        <th className="px-2 py-2">Dernier fetch</th>
        <th className="px-2 py-2">Erreurs</th>
        <th className="px-2 py-2 w-28">Actions</th>
      </tr>
    </thead>
  );

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-4">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          Sources RSS
          <span className="text-xs font-normal bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </h2>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 w-56"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Group-by toggle */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {([['none', 'Liste'], ['tags', 'Par thématique'], ['country', 'Par pays']] as const).map(([val, label]) => (
            <button key={val}
              onClick={() => { setGroupBy(val); setCollapsed(new Set()); }}
              className={`px-3 py-1.5 transition-colors ${groupBy === val ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Add */}
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* ---- Filter bar ---- */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={filters.continent ?? ''}
          onChange={e => setFilters(f => ({ ...f, continent: e.target.value || undefined, country: undefined }))}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Continent</option>
          {distinctValues.continents.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.country ?? ''}
          onChange={e => setFilters(f => ({ ...f, country: e.target.value || undefined }))}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Pays</option>
          {countriesForContinent.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.tag ?? ''}
          onChange={e => setFilters(f => ({ ...f, tag: e.target.value || undefined }))}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Tags</option>
          {distinctValues.tags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filters.tier ?? ''}
          onChange={e => setFilters(f => ({ ...f, tier: e.target.value || undefined }))}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Tier</option>
          {distinctValues.tiers.map(t => <option key={t} value={String(t)}>T{t}</option>)}
        </select>

        <select value={filters.status ?? ''}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
          <option value="">Statut</option>
          <option value="active">Actif</option>
          <option value="degraded">Dégradé</option>
          <option value="error">Erreur</option>
          <option value="disabled">Désactivé</option>
        </select>

        {Object.values(filters).some(Boolean) && (
          <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline ml-1">
            Réinitialiser
          </button>
        )}
      </div>

      {/* ---- Bulk action bar ---- */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm">
          <span className="font-medium text-blue-800">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          <button onClick={() => handleBulk('activate')}
            className="px-2.5 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs">
            Activer
          </button>
          <button onClick={() => handleBulk('deactivate')}
            className="px-2.5 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-xs">
            Désactiver
          </button>
          <button onClick={() => handleBulk('delete')}
            className="px-2.5 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs">
            Supprimer
          </button>
        </div>
      )}

      {/* ---- Table ---- */}
      <div className="border border-slate-200/60 rounded-xl bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin" /> Chargement des sources...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Aucune source trouvée.
          </div>
        ) : groupBy === 'none' ? (
          /* -- Flat list -- */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <TableHead />
              <tbody>
                {filtered.map(s => <SourceRow key={s.id} s={s} />)}
              </tbody>
            </table>
          </div>
        ) : groupBy === 'tags' ? (
          /* -- Grouped by tags -- */
          <div>
            {(grouped as [string, CatalogSource[]][])?.map(([tag, list]) => {
              const key = `tag:${tag}`;
              const isOpen = !collapsed.has(key);
              return (
                <div key={key}>
                  <button onClick={() => toggleCollapse(key)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700 transition-colors border-b border-slate-200/60">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">{tag}</span>
                    <span className="text-xs text-slate-400 ml-1">({list.length})</span>
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <TableHead />
                        <tbody>
                          {list.map(s => <SourceRow key={s.id} s={s} />)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* -- Grouped by country (two-level) -- */
          <div>
            {(grouped as { continent: string; countries: [string, CatalogSource[]][] }[])?.map(({ continent, countries: ctries }) => {
              const contKey = `cont:${continent}`;
              const contOpen = !collapsed.has(contKey);
              const total = ctries.reduce((n, [, l]) => n + l.length, 0);
              return (
                <div key={contKey}>
                  <button onClick={() => toggleCollapse(contKey)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-sm font-semibold text-slate-700 transition-colors border-b border-slate-200/60">
                    {contOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    {continent}
                    <span className="text-xs font-normal text-slate-400">({total})</span>
                  </button>
                  {contOpen && ctries.map(([country, list]) => {
                    const ctryKey = `ctry:${continent}:${country}`;
                    const ctryOpen = !collapsed.has(ctryKey);
                    return (
                      <div key={ctryKey}>
                        <button onClick={() => toggleCollapse(ctryKey)}
                          className="w-full flex items-center gap-2 pl-8 pr-4 py-2 bg-slate-50/80 hover:bg-slate-100 text-sm text-slate-600 transition-colors border-b border-slate-100">
                          {ctryOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          {country}
                          <span className="text-xs text-slate-400">({list.length})</span>
                        </button>
                        {ctryOpen && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <TableHead />
                              <tbody>
                                {list.map(s => <SourceRow key={s.id} s={s} />)}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  Edit Modal                                                      */}
      {/* ================================================================ */}
      {editSource && <EditModal source={editSource} onClose={() => setEditSource(null)} onSave={async (data) => {
        await updateSource(editSource.id, data);
        setEditSource(null);
        await fetchSources();
      }} />}

      {/* ================================================================ */}
      {/*  Add Modal                                                       */}
      {/* ================================================================ */}
      {showAddModal && <AddModal onClose={() => setShowAddModal(false)} onDone={() => {
        setShowAddModal(false);
        fetchSources();
      }} />}
    </div>
  );
}

/* ================================================================ */
/*  Edit Modal                                                       */
/* ================================================================ */

function EditModal({ source, onClose, onSave }: {
  source: CatalogSource;
  onClose: () => void;
  onSave: (data: Partial<CatalogSource>) => Promise<void>;
}) {
  const [name, setName] = useState(source.name);
  const [tagsStr, setTagsStr] = useState(source.tags.join(', '));
  const [tier, setTier] = useState(source.tier);
  const [country, setCountry] = useState(source.country ?? '');
  const [continent, setContinent] = useState(source.continent ?? '');
  const [description, setDescription] = useState(source.description ?? '');
  const [active, setActive] = useState(source.active);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
        tier,
        country: country || null,
        continent: continent || null,
        description: description || null,
        active,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200/60 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Modifier la source</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Read-only */}
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <div><span className="font-medium text-slate-600">URL:</span> <span className="break-all">{source.url}</span></div>
            <div><span className="font-medium text-slate-600">Origine:</span> {source.origin}</div>
            <div><span className="font-medium text-slate-600">Dernier fetch:</span> {timeAgo(source.last_fetched_at)}</div>
            <div><span className="font-medium text-slate-600">Erreurs:</span> {source.fetch_error_count}{source.last_error && <span className="text-red-500 ml-1">— {source.last_error}</span>}</div>
          </div>

          {/* Name */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nom</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </label>

          {/* Tags */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Tags <span className="text-xs text-slate-400 font-normal">(séparés par des virgules)</span></span>
            <input type="text" value={tagsStr} onChange={e => setTagsStr(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </label>

          {/* Tier + Country row */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tier</span>
              <select value={tier} onChange={e => setTier(Number(e.target.value))}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                {[1, 2, 3, 4].map(t => <option key={t} value={t}>T{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Pays</span>
              <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
            </label>
          </div>

          {/* Continent */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Continent</span>
            <select value={continent} onChange={e => setContinent(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30">
              <option value="">— Aucun —</option>
              {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none" />
          </label>

          {/* Active checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-blue-600 rounded" />
            Source active
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================ */
/*  Add Modal                                                        */
/* ================================================================ */

function AddModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [urls, setUrls] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    added: { url: string; name: string }[];
    errors: { url: string; error: string }[];
  } | null>(null);

  const handleSubmit = async () => {
    const lines = urls.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setSubmitting(true);
    try {
      const res = await bulkAddSources(lines);
      setResult(res);
    } catch (e) {
      console.error('bulk add failed', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl border border-slate-200/60 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Ajouter des sources</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">URLs RSS <span className="text-xs text-slate-400 font-normal">(une par ligne)</span></span>
                <textarea value={urls} onChange={e => setUrls(e.target.value)} rows={6}
                  placeholder="https://example.com/rss&#10;https://other.com/feed.xml"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none" />
              </label>
              <div className="flex justify-end gap-2">
                <button onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Annuler
                </button>
                <button onClick={handleSubmit} disabled={submitting || !urls.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Catégorisation...' : 'Valider & catégoriser'}
                </button>
              </div>
            </>
          ) : (
            <>
              {result.added.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-2">
                    {result.added.length} source{result.added.length > 1 ? 's' : ''} ajoutée{result.added.length > 1 ? 's' : ''}
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {result.added.map(a => (
                      <li key={a.url} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        <span className="font-medium">{a.name}</span>
                        <span className="text-slate-400 truncate">{a.url}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2">
                    {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}
                  </h4>
                  <ul className="text-xs text-red-600 space-y-1">
                    {result.errors.map(e => (
                      <li key={e.url}>
                        <span className="font-mono">{e.url}</span> — {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <button onClick={onDone}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
