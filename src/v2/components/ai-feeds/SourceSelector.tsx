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
        const found = result.feeds_found[0]!;
        const added = await addFeedSource(feedId, {
          url: found.url, name: found.title || customUrl.trim(), origin: 'custom',
        });
        setFeedSources(prev => [...prev, added]);
        setCustomUrl('');
      }
    } catch { /* silent */ }
    setValidating(false);
  }

  if (!feedId) {
    // Creation mode: show catalog browser only
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-[#1e2d3d]">
          <h4 className="text-[11px] font-bold text-[#b0bec9] mb-1">Sources disponibles</h4>
          <p className="text-[9px] text-[#556677]">Les sources seront ajoutées automatiquement à la sauvegarde</p>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col p-3">
          <div className="flex gap-1.5 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#556677]" size={10} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-6 pr-2 py-1 text-[10px] border border-[#1e2d3d] rounded focus:outline-none focus:border-[#42d3a5] bg-[#0f1923]"
              />
            </div>
            <select
              value={continent}
              onChange={e => setContinent(e.target.value)}
              className="text-[10px] px-2 py-1 border border-[#1e2d3d] rounded bg-[#0f1923] focus:outline-none focus:border-[#42d3a5]"
            >
              <option value="">Tous continents</option>
              {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="text-[10px] text-[#6b7d93] mb-2">{catalog.length} sources</div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {catalog.slice(0, 50).map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-[#162230]"
              >
                <Globe size={10} className="text-[#556677] shrink-0" />
                <span className="text-[10px] text-[#8899aa] font-medium flex-1 truncate">{s.name}</span>
                <span className="text-[8px] text-[#556677]">{s.country}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Feed sources (top) */}
      <div className="p-3 border-b border-[#1e2d3d]">
        <h4 className="text-[11px] font-bold text-[#b0bec9] mb-2">
          Sources actives ({feedSources.filter(s => s.enabled).length})
        </h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {feedSources.map(s => (
            <div key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#162230] group">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={e => handleToggle(s.id, e.target.checked)}
                className="rounded text-[#42d3a5] focus:ring-[#42d3a5] w-3 h-3"
              />
              <span className="text-[10px] text-[#8899aa] flex-1 truncate">{s.name}</span>
              <span className="text-[8px] text-[#556677]">{s.country || s.origin}</span>
              <button onClick={() => handleRemove(s.id)} className="opacity-0 group-hover:opacity-100 text-[#556677] hover:text-red-500">
                <X size={10} />
              </button>
            </div>
          ))}
          {feedSources.length === 0 && (
            <div className="text-[10px] text-[#556677] text-center py-2">Aucune source — ajoutez depuis le catalogue</div>
          )}
        </div>
      </div>

      {/* Custom URLs — single or bulk paste */}
      <div className="p-3 border-b border-[#1e2d3d]">
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-[10px] font-bold text-[#b0bec9]">Ajouter des sources</h4>
          <button
            onClick={() => setCustomUrl(prev => prev.includes('\n') ? '' : prev)}
            className="text-[9px] text-[#556677] hover:text-[#42d3a5]"
          >
            {customUrl.includes('\n') ? 'Mode simple' : 'Coller une liste'}
          </button>
        </div>
        {customUrl.includes('\n') || customUrl.split('\n').length > 1 ? (
          <>
            <textarea
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              placeholder={"Collez une liste d'URLs RSS (une par ligne)\nhttps://example.com/rss\nhttps://other.com/feed"}
              rows={4}
              className="w-full px-2.5 py-1.5 text-[10px] border border-[#1e2d3d] rounded-lg focus:outline-none focus:border-[#42d3a5] bg-[#0f1923] resize-none"
            />
            <button
              onClick={async () => {
                if (!feedId || validating) return;
                const urls = customUrl.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
                if (!urls.length) return;
                setValidating(true);
                for (const url of urls) {
                  try {
                    const result = await validateUrl(url);
                    if (result.valid && result.feeds_found.length > 0) {
                      const found = result.feeds_found[0]!;
                      const added = await addFeedSource(feedId, { url: found.url, name: found.title || url, origin: 'custom' });
                      setFeedSources(prev => [...prev, added]);
                    }
                  } catch { /* skip invalid */ }
                }
                setCustomUrl('');
                setValidating(false);
              }}
              disabled={validating || !customUrl.trim()}
              className="mt-1.5 w-full py-1.5 text-[10px] font-semibold rounded-lg bg-[#42d3a5] text-white hover:bg-[#38b891] disabled:opacity-50 transition-colors"
            >
              {validating ? 'Validation...' : `Ajouter ${customUrl.split('\n').filter(u => u.trim().startsWith('http')).length} URLs`}
            </button>
          </>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={customUrl}
              onChange={e => setCustomUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCustomUrl()}
              placeholder="Ajouter une URL RSS..."
              className="flex-1 px-2.5 py-1.5 text-[10px] border border-[#1e2d3d] rounded-lg focus:outline-none focus:border-[#42d3a5] bg-[#0f1923]"
            />
            <button
              onClick={handleCustomUrl}
              disabled={validating || !customUrl.trim()}
              className="p-1.5 rounded-lg bg-[#131d2a] text-[#6b7d93] hover:bg-[#42d3a5] hover:text-white disabled:opacity-50 transition-colors"
            >
              {validating ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            </button>
          </div>
        )}
      </div>

      {/* Catalog browser */}
      <div className="flex-1 overflow-hidden flex flex-col p-3">
        <h4 className="text-[11px] font-bold text-[#b0bec9] mb-2">Catalogue ({catalog.length} sources)</h4>
        <div className="flex gap-1.5 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#556677]" size={10} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-6 pr-2 py-1 text-[10px] border border-[#1e2d3d] rounded focus:outline-none focus:border-[#42d3a5] bg-[#0f1923]"
            />
          </div>
          <select
            value={continent}
            onChange={e => setContinent(e.target.value)}
            className="text-[10px] px-2 py-1 border border-[#1e2d3d] rounded bg-[#0f1923] focus:outline-none focus:border-[#42d3a5]"
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
                feedSourceUrls.has(s.url) ? 'bg-[#42d3a5]/5 opacity-60' : 'hover:bg-[#162230]'
              }`}
            >
              <Globe size={10} className="text-[#556677] shrink-0" />
              <span className="text-[10px] text-[#8899aa] font-medium flex-1 truncate">{s.name}</span>
              <span className="text-[8px] text-[#556677]">{s.country}</span>
              {!feedSourceUrls.has(s.url) && <Plus size={10} className="text-[#42d3a5]" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
