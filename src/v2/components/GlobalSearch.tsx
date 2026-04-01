// src/v2/components/GlobalSearch.tsx
// Cmd+K global search — dual scope: "Mes articles" + "Sources publiques"
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Globe, Clock, Shield, ChevronRight, Loader2, Rss } from 'lucide-react';
import { api } from '@/v2/lib/api';
import { useArticleReader } from '@/v2/hooks/useArticleReader';
import { useTheme } from '@/v2/lib/theme';

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  source_id: string;
  pub_date?: string;
  threat_level?: string;
  family?: string;
  section?: string;
  lang?: string;
}

interface CatalogResult {
  id: string;
  name: string;
  url: string;
  country?: string;
  tags?: string[];
  lang?: string;
}

const THREAT_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-300',
  info: 'bg-slate-300',
};

function formatSource(s: string) {
  return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'maintenant';
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

export default function GlobalSearch() {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'account' | 'public'>('account');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [catalogResults, setCatalogResults] = useState<CatalogResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openArticle = useArticleReader();

  // Cmd+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
      setCatalogResults([]);
      setSelectedIdx(0);
    }
  }, [open]);

  // Search with debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setCatalogResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setSelectedIdx(0);
      if (scope === 'account') {
        api(`/articles/v1/search?q=${encodeURIComponent(query)}&limit=20`)
          .then((data: any) => setResults(data.articles || []))
          .catch(() => setResults([]))
          .finally(() => setLoading(false));
      } else {
        // Search in RSS catalog (public feeds)
        api(`/ai-feeds/catalog/sources?search=${encodeURIComponent(query)}&limit=20`)
          .then((data: any) => setCatalogResults(data.sources || []))
          .catch(() => setCatalogResults([]))
          .finally(() => setLoading(false));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, scope]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = scope === 'account' ? results : catalogResults;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items.length > 0) {
      e.preventDefault();
      if (scope === 'account' && results[selectedIdx]) {
        openArticle(results[selectedIdx].id);
        setOpen(false);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setScope(s => s === 'account' ? 'public' : 'account');
    }
  }, [scope, results, catalogResults, selectedIdx, openArticle]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-400 border rounded-lg hover:border-slate-300 hover:text-slate-500 transition-colors" style={{ background: t.bgSidebar, borderColor: t.border }}
        title="Recherche (Ctrl+K)"
      >
        <Search size={12} />
        <span>Rechercher...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono text-slate-300 border rounded" style={{ background: t.bgCard, borderColor: t.border }}>
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-[2px]" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-[600px] rounded-2xl shadow-2xl z-[61] overflow-hidden border" style={{ background: t.bgCard, borderColor: t.border }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: t.border }}>
          <Search size={18} className="text-slate-300 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher des articles..."
            className="flex-1 text-[15px] placeholder-slate-300 outline-none bg-transparent" style={{ color: t.textPrimary }}
            autoComplete="off"
          />
          {loading && <Loader2 size={16} className="text-slate-300 animate-spin shrink-0" />}
          <button onClick={() => setOpen(false)} className="p-1 text-slate-300 hover:text-slate-500 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Scope tabs */}
        <div className="flex border-b" style={{ borderColor: t.border }}>
          <button
            onClick={() => setScope(`account`)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              scope === 'account'
                ? 'text-[#42d3a5] border-b-2 border-[#42d3a5] bg-teal-50/30'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText size={13} />
            Mes articles
          </button>
          <button
            onClick={() => setScope('public')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors ${
              scope === 'public'
                ? 'text-[#42d3a5] border-b-2 border-[#42d3a5] bg-teal-50/30'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Globe size={13} />
            Sources publiques
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">

          {/* Empty state */}
          {!loading && query.length >= 2 && scope === 'account' && results.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Aucun article trouvé pour "{query}"
            </div>
          )}
          {!loading && query.length >= 2 && scope === `public` && catalogResults.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Aucune source trouvée pour "{query}"
            </div>
          )}

          {/* Hint */}
          {query.length < 2 && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-slate-400">Tapez au moins 2 caractères</p>
              <p className="text-[10px] text-slate-300 mt-2">
                <kbd className="px-1.5 py-0.5 border rounded text-[9px] font-mono" style={{ background: t.bgSidebar, borderColor: t.border }}>Tab</kbd> pour changer d`onglet ·
                <kbd className="px-1.5 py-0.5 border rounded text-[9px] font-mono ml-1" style={{ background: t.bgSidebar, borderColor: t.border }}>↑↓</kbd> naviguer ·
                <kbd className="px-1.5 py-0.5 border rounded text-[9px] font-mono ml-1" style={{ background: t.bgSidebar, borderColor: t.border }}>Enter</kbd> ouvrir
              </p>
            </div>
          )}

          {/* Account results */}
          {scope === 'account' && results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => { openArticle(r.id); setOpen(false); }}
              className={`w-full text-left px-5 py-3 flex items-start gap-3 transition-colors border-b border-slate-50 ${
                i === selectedIdx ? 'bg-teal-50/50' : 'hover:bg-[#162230]'
              }`}
            >
              {/* Threat dot */}
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${THREAT_DOT[r.threat_level || ''] || 'bg-slate-200'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: t.textPrimary }}>{r.title}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <span className="truncate max-w-[150px]">{formatSource(r.source_id)}</span>
                  {r.pub_date && <><span className="text-slate-200">·</span><span>{timeAgo(r.pub_date)}</span></>}
                  {r.family && (
                    <>
                      <span className="text-slate-200">·</span>
                      <span className="text-slate-500">{r.family}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-200 shrink-0 mt-1" />
            </button>
          ))}

          {/* Public catalog results */}
          {scope === 'public' && catalogResults.map((r, i) => (
            <div
              key={r.id || r.url}
              className={`px-5 py-3 flex items-start gap-3 border-b border-slate-50 ${
                i === selectedIdx ? 'bg-teal-50/50' : ''
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                <Rss size={13} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium" style={{ color: t.textPrimary }}>{r.name}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{r.url}</p>
                <div className="flex items-center gap-2 mt-1">
                  {r.country && <span className="text-[9px] px-1.5 py-0.5 text-slate-500 rounded" style={{ background: t.bgSidebar }}>{r.country}</span>}
                  {r.lang && <span className="text-[9px] px-1.5 py-0.5 text-slate-500 rounded" style={{ background: t.bgSidebar }}>{r.lang}</span>}
                  {r.tags?.slice(0, 3).map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-600 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t flex items-center justify-between text-[10px] text-slate-400" style={{ borderColor: t.border, background: `${t.bgSidebar}80` }}>
          <span>
            {scope === 'account'
              ? `${results.length} article${results.length !== 1 ? 's' : ''}`
              : `${catalogResults.length} source${catalogResults.length !== 1 ? 's' : ''}`
            }
          </span>
          <span>Esc pour fermer</span>
        </div>
      </div>
    </>
  );
}
