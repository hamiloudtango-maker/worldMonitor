// src/v2/components/ai-feeds/SourceSelector.tsx
import { useState, useEffect } from 'react';
import { Search, Plus, Globe, X, Loader2, ExternalLink } from 'lucide-react';
import { listCatalog, validateUrl, addFeedSource, removeFeedSource, listFeedSources, toggleFeedSource } from '@/v2/lib/ai-feeds-api';
import type { CatalogSource, AIFeedSourceData } from '@/v2/lib/ai-feeds-api';

interface Props {
  feedId: string | null;
}

const CONTINENTS = ['Europe', 'Asie', 'Afrique', 'Amerique du Nord', 'Amerique du Sud', 'Oceanie', 'Moyen-Orient'];

export default function SourceSelector({ feedId }: Props) {
  const [catalog, setCatalog] = useState<CatalogSource[]>([]);
  const [feedSources, setFeedSources] = useState<AIFeedSourceData[]>([]);
  const [search, setSearch] = useState('');
  const [continent, setContinent] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load catalog
  useEffect(() => {
    listCatalog({ q: search || undefined, continent: continent || undefined })
      .then(d => setCatalog(d.sources))
      .catch(() => {});
  }, [search, continent]);

  // Load feed sources
  useEffect(() => {
    if (!feedId) { setFeedSources([]); return; }
    listFeedSources(feedId).then(d => setFeedSources(d.sources)).catch(() => {});
  }, [feedId]);

  const feedSourceUrls = new Set(feedSources.map(s => s.url));

  async function handleAddFromCatalog(source: CatalogSource) {
    if (!feedId || feedSourceUrls.has(source.url)) return;
    setLoading(true);
    try {
      const added = await addFeedSource(feedId, {
        url: source.url, name: source.name, lang: source.lang ?? undefined,
        tier: source.tier, source_type: source.source_type ?? undefined,
        country: source.country ?? undefined, continent: source.continent ?? undefined,
        origin: 'catalog',
      });
      setFeedSources(prev => [...prev, added]);
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleRemove(sourceId: string) {
    if (!feedId) return;
    try {
      await removeFeedSource(feedId, sourceId);
      setFeedSources(prev => prev.filter(s => s.id !== sourceId));
    } catch { /* silent */ }
  }

  async function handleToggle(sourceId: string, enabled: boolean) {
    if (!feedId) return;
    try {
      const updated = await toggleFeedSource(feedId, sourceId, enabled);
      setFeedSources(prev => prev.map(s => s.id === sourceId ? updated : s));
    } catch { /* silent */ }
  }

  async function handleCustomUrl() {
    if (!feedId || !customUrl.trim()) return;
    setValidating(true);
    try {
      const result = await validateUrl(customUrl.trim());
      if (result.valid && result.feeds_found.length > 0) {
        const feed = result.feeds_found[0];
        const added = await addFeedSource(feedId, {
          url: feed.url, name: feed.title || customUrl.trim(), origin: 'custom',
        });
        setFeedSources(prev => [...prev, added]);
        setCustomUrl('');
      }
    } catch { /* silent */ }
    setValidating(false);
  }

  if (!feedId) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-slate-400">
        Sélectionnez un feed pour gérer ses sources
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Feed sources (top) */}
      <div className="p-3 border-b border-slate-100">
        <h4 className="text-[11px] font-bold text-slate-900 mb-2">
          Sources actives ({feedSources.filter(s => s.enabled).length})
        </h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {feedSources.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 group">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={e => handleToggle(s.id, e.target.checked)}
                className="rounded text-[#42d3a5] focus:ring-[#42d3a5] w-3 h-3"
              />
              <span className="text-[10px] text-slate-700 flex-1 truncate">{s.name}</span>
              <span className="text-[8px] text-slate-400">{s.country || s.origin}</span>
              <button onClick={() => handleRemove(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500">
                <X size={10} />
              </button>
            </div>
          ))}
          {feedSources.length === 0 && (
            <div className="text-[10px] text-slate-400 text-center py-2">Aucune source — ajoutez depuis le catalogue</div>
          )}
        </div>
      </div>

      {/* Custom URL */}
      <div className="p-3 border-b border-slate-100">
        <div className="flex gap-1.5">
          <input
            value={customUrl}
            onChange={e => setCustomUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomUrl()}
            placeholder="Ajouter une URL RSS..."
            className="flex-1 px-2.5 py-1.5 text-[10px] border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5] bg-slate-50"
          />
          <button
            onClick={handleCustomUrl}
            disabled={validating || !customUrl.trim()}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-[#42d3a5] hover:text-white disabled:opacity-50 transition-colors"
          >
            {validating ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
          </button>
        </div>
      </div>

      {/* Catalog browser */}
      <div className="flex-1 overflow-hidden flex flex-col p-3">
        <h4 className="text-[11px] font-bold text-slate-900 mb-2">Catalogue ({catalog.length} sources)</h4>
        <div className="flex gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-6 pr-2 py-1 text-[10px] border border-slate-200 rounded focus:outline-none focus:border-[#42d3a5] bg-slate-50"
            />
          </div>
          <select
            value={continent}
            onChange={e => setContinent(e.target.value)}
            className="text-[10px] px-2 py-1 border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-[#42d3a5]"
          >
            <option value="">Tous continents</option>
            {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {catalog.slice(0, 50).map((s, i) => (
            <button
              key={i}
              onClick={() => handleAddFromCatalog(s)}
              disabled={feedSourceUrls.has(s.url) || loading}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                feedSourceUrls.has(s.url) ? 'bg-[#42d3a5]/5 opacity-60' : 'hover:bg-slate-50'
              }`}
            >
              <Globe size={10} className="text-slate-400 shrink-0" />
              <span className="text-[10px] text-slate-700 font-medium flex-1 truncate">{s.name}</span>
              <span className="text-[8px] text-slate-400">{s.country}</span>
              {!feedSourceUrls.has(s.url) && <Plus size={10} className="text-[#42d3a5]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
