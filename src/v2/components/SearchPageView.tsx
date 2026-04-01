// src/v2/components/SearchPageView.tsx
// Inoreader-style full search page: "In your account" / "In all public feeds"
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Star, BookmarkPlus, MoreHorizontal, Clock, Filter } from 'lucide-react';
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
  image_url?: string;
}

function formatSource(s: string) {
  return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "maintenant";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

export default function SearchPageView() {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'account' | 'public'>('account');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [language, setLanguage] = useState('');
  const [matchScope, setMatchScope] = useState('all');
  const [order, setOrder] = useState('newest');
  const inputRef = useRef<HTMLInputElement>(null);
  const openArticle = useArticleReader();

  useEffect(() => {
    inputRef.current?.focus();
    const saved = localStorage.getItem('wm-recent-searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const doSearch = useCallback(async () => {
    if (!query.trim() || query.length < 2) return;
    setLoading(true);

    // Save to recent
    const recent = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
    setRecentSearches(recent);
    localStorage.setItem('wm-recent-searches', JSON.stringify(recent));

    try {
      const data = await api(`/articles/v1/search?q=${encodeURIComponent(query)}&limit=50`);
      setResults((data as any).articles || []);
      setTotal((data as any).total || 0);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, [query, recentSearches]);

  return (
    <div className="h-full overflow-y-auto -m-5" style={{ background: t.bgApp }}>
      <div className="max-w-4xl mx-auto px-6 py-6">

        {/* Title */}
        <h1 className="text-[22px] font-bold mb-4" style={{ color: t.textPrimary }}>Recherche d'articles</h1>

        {/* Scope tabs */}
        <div className="flex gap-4 mb-5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <button
            onClick={() => setScope('account')}
            className="pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors"
            style={{
              color: scope === 'account' ? t.accent : t.textSecondary,
              borderBottom: scope === 'account' ? `2px solid ${t.accent}` : '2px solid transparent',
            }}
          >
            Dans votre compte
          </button>
          <button
            onClick={() => setScope('public')}
            className="pb-2 text-[12px] font-bold uppercase tracking-wider transition-colors"
            style={{
              color: scope === 'public' ? t.accent : t.textSecondary,
              borderBottom: scope === 'public' ? `2px solid ${t.accent}` : '2px solid transparent',
            }}
          >
            Dans tous les feeds publics
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textSecondary }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-3 text-[14px] rounded-xl focus:outline-none"
              style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }}
            />
          </div>
          <button
            onClick={doSearch}
            className="px-5 py-3 rounded-xl text-[13px] font-semibold text-white transition-colors"
            style={{ background: t.accent }}
          >
            Rechercher
          </button>
        </div>

        {/* Recent searches */}
        {!loading && results.length === 0 && recentSearches.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={13} style={{ color: t.textSecondary }} />
              <span className="text-[11px] font-medium" style={{ color: t.textSecondary }}>Recherches récentes</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s, i) => (
                <button key={i} onClick={() => { setQuery(s); }} className="px-3 py-1.5 rounded-lg text-[11px] transition-colors" style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && results.length === 0 && query.length < 2 && (
          <div className="rounded-xl p-10 text-center" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <Search size={32} className="mx-auto mb-3" style={{ color: t.textSecondary }} />
            <h3 className="text-[14px] font-semibold mb-2" style={{ color: t.textSecondary }}>Rechercher dans vos feeds</h3>
            <p className="text-[12px]" style={{ color: t.textSecondary }}>Explorez les articles de vos sources. Convertissez vos recherches en feeds de monitoring.</p>
          </div>
        )}

        {/* Filters row */}
        {results.length > 0 && (
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select value={language} onChange={e => setLanguage(e.target.value)} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}>
              <option value="">Toutes les langues</option>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
              <option value="de">Allemand</option>
              <option value="es">Espagnol</option>
              <option value="ar">Arabe</option>
            </select>
            <select value={matchScope} onChange={e => setMatchScope(e.target.value)} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}>
              <option value="all">Titre et contenu</option>
              <option value="title">Titre uniquement</option>
            </select>
            <select value={order} onChange={e => setOrder(e.target.value)} className="text-[11px] px-3 py-1.5 rounded-lg" style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}>
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
            </select>
            <span className="text-[11px] ml-auto" style={{ color: t.textSecondary }}>{total} résultats</span>
          </div>
        )}

        {/* Results */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: t.accent, borderTopColor: 'transparent' }} />
          </div>
        )}

        <div className="space-y-2">
          {results.map(a => (
            <div
              key={a.id}
              onClick={() => openArticle(a.id)}
              className="flex items-start gap-4 px-4 py-3 rounded-xl cursor-pointer transition-colors"
              style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
            >
              {/* Thumbnail */}
              <div className="w-24 h-16 rounded-lg shrink-0 overflow-hidden" style={{ background: t.bgApp }}>
                {a.image_url && (
                  <img src={a.image_url} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold leading-snug line-clamp-2 mb-1" style={{ color: t.textPrimary }}>{a.title}</h3>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium" style={{ color: t.accent }}>{formatSource(a.source_id)}</span>
                  {a.family && <span className="text-[10px]" style={{ color: t.textSecondary }}>· {a.family}</span>}
                </div>
                {a.description && (
                  <p className="text-[11px] line-clamp-2" style={{ color: t.textSecondary }}>
                    {/* Highlight search term */}
                    {query ? a.description.replace(new RegExp(`(${query})`, 'gi'), '**$1**') : a.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[10px]" style={{ color: t.textSecondary }}>{timeAgo(a.pub_date)}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={e => e.stopPropagation()} className="p-1 rounded" style={{ color: t.textSecondary }}><Star size={13} /></button>
                    <button onClick={e => e.stopPropagation()} className="p-1 rounded" style={{ color: t.textSecondary }}><BookmarkPlus size={13} /></button>
                    <button onClick={e => e.stopPropagation()} className="p-1 rounded" style={{ color: t.textSecondary }}><MoreHorizontal size={13} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
