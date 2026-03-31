// src/v2/components/ArticleListView.tsx
// Inoreader-exact article grid — magazine cards (image + title overlay + source + actions)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Star, BookmarkPlus, Check, ExternalLink, Eye,
  LayoutList, LayoutGrid, MoreHorizontal, Search,
  ChevronDown, Columns3, ListFilter, ArrowUpDown,
} from 'lucide-react';
import { useArticleReader } from '@/v2/hooks/useArticleReader';
import { markRead, toggleStar, toggleReadLater, type ArticleSummary } from '@/v2/lib/sources-api';

/* ── Constants ── */
const BG_APP = '#131d2a';
const BG_CARD = '#1a2836';
const BORDER = '#1e2d3d';
const ACCENT = '#4d8cf5';
const TEXT_PRIMARY = '#b0bec9';
const TEXT_SECONDARY = '#6b7d93';
const TEXT_MUTED = '#3a4a5a';

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
  /** Total unread count to show in filter badge */
  unreadCount?: number;
  /** Search handler */
  onSearch?: (q: string) => void;
}

export default function ArticleListView({ articles, title, loading, onLoadMore, hasMore, unreadCount, onSearch }: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [readLaterIds, setReadLaterIds] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const openArticle = useArticleReader();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Filter unread
  const displayedArticles = showUnreadOnly
    ? articles.filter(a => !readIds.has(a.id))
    : articles;

  const displayCount = showUnreadOnly
    ? (unreadCount ?? displayedArticles.length)
    : articles.length;

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar — exact Inoreader: title ▾ | "Non lus (N)" pill | search | view toggles ── */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${BORDER}`, background: BG_APP }}>

        {/* Left: title + unread filter */}
        <div className="flex items-center gap-4">
          {title && (
            <h2 className="text-[18px] font-bold flex items-center gap-1.5" style={{ color: '#e2e8f0' }}>
              {title}
              <ChevronDown size={16} style={{ color: TEXT_SECONDARY }} />
            </h2>
          )}
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: showUnreadOnly ? `${ACCENT}20` : '#1a2836',
              color: showUnreadOnly ? ACCENT : TEXT_SECONDARY,
              border: `1px solid ${showUnreadOnly ? `${ACCENT}40` : BORDER}`,
            }}
          >
            {showUnreadOnly ? `Non lus (${displayCount})` : `Tous (${displayCount})`}
            <ChevronDown size={12} />
          </button>
        </div>

        {/* Right: search + view toggles */}
        <div className="flex items-center gap-2">
          {/* Search in articles */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: TEXT_SECONDARY }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search in articles"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); onSearch?.(e.target.value); }}
              className="pl-8 pr-3 py-1.5 rounded-lg text-[12px] outline-none w-52 transition-colors"
              style={{ background: '#1a2836', border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
              onFocus={e => { e.target.style.borderColor = ACCENT; }}
              onBlur={e => { e.target.style.borderColor = BORDER; }}
            />
          </div>

          {/* Mark all read */}
          <button
            className="p-1.5 rounded-lg transition-colors group"
            style={{ color: TEXT_SECONDARY }}
            title="Tout marquer comme lu"
          >
            <Check size={16} />
          </button>

          {/* View toggles — Inoreader has: list, magazine, card, column */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <button
              onClick={() => setViewMode('list')}
              className="p-1.5 transition-colors"
              style={{
                background: viewMode === 'list' ? `${ACCENT}20` : 'transparent',
                color: viewMode === 'list' ? ACCENT : TEXT_SECONDARY,
              }}
              title="Liste"
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className="p-1.5 transition-colors"
              style={{
                background: viewMode === 'card' ? `${ACCENT}20` : 'transparent',
                color: viewMode === 'card' ? ACCENT : TEXT_SECONDARY,
                borderLeft: `1px solid ${BORDER}`,
              }}
              title="Magazine"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          {/* Sort */}
          <button
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: TEXT_SECONDARY }}
            title="Trier"
          >
            <ArrowUpDown size={15} />
          </button>

          {/* Settings */}
          <button
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: TEXT_SECONDARY }}
            title="Personnaliser la vue"
          >
            <ListFilter size={15} />
          </button>
        </div>
      </div>

      {/* ── Article content ── */}
      <div ref={listRef} className="flex-1 overflow-y-auto" style={{ background: BG_APP }}>
        {viewMode === 'card' ? (
          /* ══════════════════════════════════════════════════════
             CARD MODE — Inoreader exact: responsive grid,
             image fills card, title + source overlay at bottom,
             actions bar below image
             ══════════════════════════════════════════════════════ */
          <div
            className="grid gap-3 p-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            }}
          >
            {displayedArticles.map((a, idx) => {
              const isRead = readIds.has(a.id);
              const isStarred = starredIds.has(a.id);
              const isReadLater = readLaterIds.has(a.id);
              const imgUrl = a.image_url;
              return (
                <div
                  key={a.id}
                  onClick={() => handleClick(a, idx)}
                  className="rounded-xl overflow-hidden cursor-pointer transition-all group"
                  style={{
                    background: BG_CARD,
                    opacity: isRead ? 0.45 : 1,
                  }}
                >
                  {/* Image area with gradient + title overlay */}
                  <div className="relative overflow-hidden" style={{ paddingBottom: '65%', background: '#0f1923' }}>
                    {imgUrl && (
                      <img
                        src={imgUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {/* Gradient overlay */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(0deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.05) 100%)',
                      }}
                    />
                    {/* Title + source */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-[13px] font-bold leading-snug line-clamp-2 text-white mb-1">
                        {a.title}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium" style={{ color: '#7cb3f5' }}>
                          {formatSource(a.source_id)}
                        </span>
                        <ExternalLink size={9} style={{ color: '#7cb3f5' }} />
                      </div>
                    </div>
                  </div>

                  {/* Bottom bar: time + actions — exact Inoreader */}
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <span className="text-[11px]" style={{ color: TEXT_SECONDARY }}>
                      {timeAgo(a.pub_date)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleStar(a.id); }}
                        className="p-1 rounded transition-colors"
                        style={{ color: isStarred ? '#d4a843' : TEXT_MUTED }}
                        title="Favoris"
                      >
                        <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleReadLater(a.id); }}
                        className="p-1 rounded transition-colors"
                        style={{ color: isReadLater ? ACCENT : TEXT_MUTED }}
                        title="Lire plus tard"
                      >
                        <BookmarkPlus size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleMarkRead(a.id); }}
                        className="p-1 rounded transition-colors"
                        style={{ color: isRead ? '#42d3a5' : TEXT_MUTED }}
                        title="Marquer comme lu"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={e => e.stopPropagation()}
                        className="p-1 rounded transition-colors"
                        style={{ color: TEXT_MUTED }}
                        title="Plus"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════
             LIST MODE — compact rows
             ══════════════════════════════════════════════════════ */
          <div>
            {displayedArticles.map((a, idx) => {
              const isRead = readIds.has(a.id);
              const isStarred = starredIds.has(a.id);
              const isSelected = idx === selectedIdx;

              return (
                <div
                  key={a.id}
                  id={`article-item-${idx}`}
                  onClick={() => handleClick(a, idx)}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                  style={{
                    borderBottom: `1px solid ${BORDER}`,
                    background: isSelected ? BG_CARD : 'transparent',
                    borderLeft: isSelected ? `2px solid ${ACCENT}` : '2px solid transparent',
                    opacity: isRead ? 0.45 : 1,
                  }}
                >
                  {/* Thumbnail */}
                  {a.image_url && (
                    <div className="w-20 h-14 rounded-lg shrink-0 overflow-hidden" style={{ background: '#0f1923' }}>
                      <img src={a.image_url} alt="" className="w-full h-full object-cover" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug line-clamp-2 font-medium" style={{ color: isRead ? TEXT_SECONDARY : '#e2e8f0' }}>
                      {a.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: TEXT_SECONDARY }}>
                      <span className="font-medium" style={{ color: '#7cb3f5' }}>{formatSource(a.source_id)}</span>
                      {a.pub_date && <><span style={{ color: TEXT_MUTED }}>·</span><span>{timeAgo(a.pub_date)}</span></>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0" style={{ opacity: isSelected ? 1 : 0.3 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleStar(a.id); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: isStarred ? '#d4a843' : TEXT_MUTED }}
                    >
                      <Star size={13} fill={isStarred ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleToggleReadLater(a.id); }}
                      className="p-1 rounded transition-colors"
                      style={{ color: readLaterIds.has(a.id) ? ACCENT : TEXT_MUTED }}
                    >
                      <BookmarkPlus size={13} />
                    </button>
                    <button
                      onClick={e => e.stopPropagation()}
                      className="p-1 rounded transition-colors"
                      style={{ color: TEXT_MUTED }}
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
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
              className="px-4 py-2 text-xs font-medium rounded-lg transition-colors"
              style={{ color: ACCENT, background: `${ACCENT}15` }}
            >
              Charger plus d'articles
            </button>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
          </div>
        )}

        {!loading && displayedArticles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: TEXT_SECONDARY }}>
            <LayoutList size={32} className="mb-3" style={{ color: TEXT_MUTED }} />
            <p className="text-sm">Aucun article</p>
          </div>
        )}
      </div>
    </div>
  );
}
