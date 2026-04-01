// src/v2/components/ai-feeds/FeedPreview.tsx
// Inoreader-style grid view for feed articles
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Star, BookmarkPlus, MoreHorizontal } from 'lucide-react';
import { listFeedArticles } from '@/v2/lib/ai-feeds-api';
import type { AIFeedArticle, PreviewArticle } from '@/v2/lib/ai-feeds-api';
import { timeAgo } from '@/v2/lib/constants';
import { useArticleReader } from '@/v2/hooks/useArticleReader';
import { useTheme } from '@/v2/lib/theme';

interface Props {
  feedId: string | null;
  onCountChange?: (count: number) => void;
  refreshKey?: number;
}

function formatSource(s: string) {
  return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
}

export default function FeedPreview({ feedId, onCountChange, refreshKey }: Props) {
  const { t } = useTheme();
  const openArticle = useArticleReader();
  const [articles, setArticles] = useState<(AIFeedArticle | PreviewArticle)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!feedId) return;
    setLoading(true);
    try {
      const { getLimit } = await import('@/v2/lib/display-settings');
      const data = await listFeedArticles(feedId, { limit: getLimit('feedArticleLimit') });
      setArticles(data.articles);
      setTotal(data.total);
      onCountChange?.(data.total);
    } catch { /* silent */ }
    setLoading(false);
  }, [feedId, onCountChange]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (!feedId) {
    return (
      <div className="text-center py-8 text-xs" style={{ color: t.textSecondary }}>
        Ajoutez des filtres pour voir l'aperçu
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[12px] font-bold" style={{ color: t.textPrimary }}>
          Aperçu{total > 0 && ` · ${total} articles`}
        </h4>
        <button onClick={load} disabled={loading} className="p-1.5 rounded transition-colors" style={{ color: t.textSecondary }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Grid of article cards — Inoreader-style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {articles.map((a, i) => {
          const id = 'id' in a ? a.id : '';
          const threatLevel = 'threat_level' in a ? a.threat_level : '';
          const imageUrl = 'image_url' in a ? (a as any).image_url : null;

          return (
            <div
              key={i}
              onClick={() => { if (id) openArticle(id); }}
              className="rounded-xl overflow-hidden cursor-pointer transition-all"
              style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#2a3f52')}
              onMouseOut={e => (e.currentTarget.style.borderColor = t.border)}
            >
              {/* Image */}
              <div className="h-36 relative overflow-hidden" style={{ background: t.bgSidebar }}>
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                {threatLevel && (threatLevel === 'critical' || threatLevel === 'high') && (
                  <div className="absolute top-2 left-2">
                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                      background: threatLevel === 'critical' ? '#ef444490' : '#f9731690',
                      color: '#fff', backdropFilter: 'blur(4px)',
                    }}>{threatLevel}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3">
                <h3 className="text-[13px] font-semibold leading-snug line-clamp-2 mb-1.5" style={{ color: t.textPrimary }}>
                  {a.title}
                </h3>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px] font-medium" style={{ color: t.accent }}>{formatSource(a.source_name)}</span>
                  {'relevance_score' in a && (
                    <>
                      <span style={{ color: t.textSecondary }}>·</span>
                      <span className="text-[10px] font-bold" style={{ color: '#42d3a5' }}>{Math.round(a.relevance_score)}%</span>
                    </>
                  )}
                </div>
                {a.summary && (
                  <p className="text-[11px] line-clamp-2 mb-2" style={{ color: t.textSecondary, lineHeight: '1.4' }}>{a.summary}</p>
                )}
                <div className="flex items-center justify-between pt-1.5" style={{ borderTop: `1px solid ${t.border}` }}>
                  <span className="text-[10px]" style={{ color: t.textSecondary }}>{a.published_at ? timeAgo(a.published_at) : ''}</span>
                  <div className="flex items-center gap-0.5">
                    <button className="p-1 rounded" style={{ color: t.textSecondary }}><Star size={12} /></button>
                    <button className="p-1 rounded" style={{ color: t.textSecondary }}><BookmarkPlus size={12} /></button>
                    <button className="p-1 rounded" style={{ color: t.textSecondary }}><MoreHorizontal size={12} /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {articles.length === 0 && !loading && (
        <div className="text-center py-10 text-xs" style={{ color: t.textSecondary }}>
          {feedId ? 'Pas encore d\'articles — ajoutez des sources et lancez un refresh' : 'Aucun article trouvé'}
        </div>
      )}
      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: t.accent, borderTopColor: 'transparent' }} />
        </div>
      )}
    </div>
  );
}
