// src/v2/components/ArticleListView.tsx
// Inoreader-style article list — list/card modes, read/star/read-later, keyboard nav
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Star, BookmarkPlus, Check, ExternalLink, Shield, Clock,
  ChevronRight, Eye, LayoutList, LayoutGrid,
} from 'lucide-react';
import { useArticleReader } from '@/v2/hooks/useArticleReader';
import { markRead, toggleStar, toggleReadLater, type ArticleSummary } from '@/v2/lib/sources-api';

const THREAT_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-300',
  info: 'bg-slate-300',
};

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

function formatSource(s: string) {
  return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
}

interface Props {
  articles: ArticleSummary[];
  title?: string;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export default function ArticleListView({ articles, title, loading, onLoadMore, hasMore }: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [readLaterIds, setReadLaterIds] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const openArticle = useArticleReader();
  const listRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation (j/k/o/s/r)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const a = articles[selectedIdx];
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, articles.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if ((e.key === 'o' || e.key === 'Enter') && a) {
        e.preventDefault();
        openArticle(a.id);
        handleMarkRead(a.id);
      } else if (e.key === 's' && a) {
        e.preventDefault();
        handleToggleStar(a.id);
      } else if (e.key === 'r' && a) {
        e.preventDefault();
        handleToggleReadLater(a.id);
      } else if (e.key === 'm' && a) {
        e.preventDefault();
        handleMarkRead(a.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIdx, articles, openArticle]);

  // Scroll selected into view
  useEffect(() => {
    const el = document.getElementById(`article-item-${selectedIdx}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  const handleMarkRead = useCallback((id: string) => {
    setReadIds(prev => new Set(prev).add(id));
    markRead(id).catch(() => {});
  }, []);

  const handleToggleStar = useCallback((id: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    toggleStar(id).catch(() => {});
  }, []);

  const handleToggleReadLater = useCallback((id: string) => {
    setReadLaterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    toggleReadLater(id).catch(() => {});
  }, []);

  const handleClick = useCallback((article: ArticleSummary, idx: number) => {
    setSelectedIdx(idx);
    openArticle(article.id);
    handleMarkRead(article.id);
  }, [openArticle, handleMarkRead]);

  // Bulk select
  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const bulkMarkRead = useCallback(() => {
    selectedIds.forEach(id => handleMarkRead(id));
    setSelectedIds(new Set());
  }, [selectedIds, handleMarkRead]);

  const bulkStar = useCallback(() => {
    selectedIds.forEach(id => handleToggleStar(id));
    setSelectedIds(new Set());
  }, [selectedIds, handleToggleStar]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          {title && <h2 className="text-sm font-bold text-slate-900">{title}</h2>}
          <span className="text-[10px] text-slate-400">{articles.length} articles</span>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[10px] font-medium text-[#42d3a5]">{selectedIds.size} sélectionnés</span>
              <button onClick={bulkMarkRead} className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded bg-slate-50">
                <Eye size={10} className="inline mr-1" />Lu
              </button>
              <button onClick={bulkStar} className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-0.5 rounded bg-slate-50">
                <Star size={10} className="inline mr-1" />Star
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'text-[#42d3a5] bg-teal-50' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'card' ? 'text-[#42d3a5] bg-teal-50' : 'text-slate-300 hover:text-slate-500'}`}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-1 bg-slate-50/50 border-b border-slate-100 text-[9px] text-slate-300 flex gap-3 shrink-0">
        <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px]">j</kbd>/<kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px]">k</kbd> naviguer</span>
        <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px]">o</kbd> ouvrir</span>
        <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px]">s</kbd> star</span>
        <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px]">r</kbd> read later</span>
        <span><kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[8px]">m</kbd> lu</span>
      </div>

      {/* Article list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {viewMode === 'list' ? (
          // ── List mode ──
          <div>
            {articles.map((a, idx) => {
              const isRead = readIds.has(a.id);
              const isStarred = starredIds.has(a.id);
              const isSelected = idx === selectedIdx;
              const isChecked = selectedIds.has(a.id);

              return (
                <div
                  key={a.id}
                  id={`article-item-${idx}`}
                  onClick={() => handleClick(a, idx)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-50 transition-colors ${
                    isSelected ? 'bg-teal-50/60 border-l-2 border-l-[#42d3a5]' : 'hover:bg-slate-50/80'
                  } ${isRead ? 'opacity-60' : ''}`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={e => toggleSelect(a.id, e)}
                    className={`mt-1 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-[#42d3a5] border-[#42d3a5] text-white' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {isChecked && <Check size={10} />}
                  </button>

                  {/* Threat dot */}
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${THREAT_DOT[a.threat_level || ''] || 'bg-slate-200'}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] leading-snug line-clamp-2 ${isRead ? 'text-slate-500' : 'text-slate-900 font-medium'}`}>
                      {a.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span className="truncate max-w-[120px] font-medium">{formatSource(a.source_id)}</span>
                      {a.pub_date && <><span className="text-slate-200">·</span><span>{timeAgo(a.pub_date)}</span></>}
                      {a.family && <><span className="text-slate-200">·</span><span className="text-slate-500">{a.family}</span></>}
                      {a.countries?.length > 0 && (
                        <><span className="text-slate-200">·</span><span>{a.countries.slice(0, 3).join(', ')}</span></>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100" style={{ opacity: isSelected ? 1 : undefined }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleStar(a.id); }}
                      className={`p-1 rounded transition-colors ${isStarred ? 'text-amber-400' : 'text-slate-200 hover:text-amber-400'}`}
                      title="Favoris"
                    >
                      <Star size={13} fill={isStarred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleReadLater(a.id); }}
                      className={`p-1 rounded transition-colors ${readLaterIds.has(a.id) ? 'text-blue-500' : 'text-slate-200 hover:text-blue-400'}`}
                      title="Lire plus tard"
                    >
                      <BookmarkPlus size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // ── Card mode ──
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
            {articles.map((a, idx) => {
              const isRead = readIds.has(a.id);
              return (
                <div
                  key={a.id}
                  onClick={() => handleClick(a, idx)}
                  className={`bg-white rounded-xl border border-slate-200/60 p-4 cursor-pointer hover:shadow-md transition-shadow ${isRead ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${THREAT_DOT[a.threat_level || ''] || 'bg-slate-200'}`} />
                    <h3 className="text-[13px] font-medium text-slate-900 leading-snug line-clamp-3 flex-1">{a.title}</h3>
                  </div>
                  {a.description && (
                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">{a.description}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate max-w-[150px]">{formatSource(a.source_id)}</span>
                    <span>{timeAgo(a.pub_date)}</span>
                  </div>
                  {a.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.tags.slice(0, 3).map(t => (
                        <span key={t} className="px-1.5 py-0.5 text-[9px] bg-teal-50 text-teal-600 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && onLoadMore && (
          <div className="flex justify-center py-4">
            <button
              onClick={onLoadMore}
              className="px-4 py-2 text-xs font-medium text-[#42d3a5] bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
            >
              Charger plus d'articles
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-[#42d3a5] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && articles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <LayoutList size={32} className="mb-3 text-slate-200" />
            <p className="text-sm">Aucun article</p>
          </div>
        )}
      </div>
    </div>
  );
}
