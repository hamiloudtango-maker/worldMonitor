// src/v2/components/ai-feeds/FeedPreview.tsx
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { listFeedArticles, previewQuery } from '@/v2/lib/ai-feeds-api';
import type { AIFeedArticle, FeedQuery, PreviewArticle } from '@/v2/lib/ai-feeds-api';
import { timeAgo } from '@/v2/lib/constants';
import { useArticleReader } from '@/v2/hooks/useArticleReader';

interface Props {
  feedId: string | null;
  query?: FeedQuery;
  onCountChange?: (count: number) => void;
}

const THREAT_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-600',
  high: 'bg-orange-100 text-orange-600',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-600',
};

export default function FeedPreview({ feedId, query, onCountChange }: Props) {
  const openArticle = useArticleReader();
  const [articles, setArticles] = useState<(AIFeedArticle | PreviewArticle)[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      if (feedId) {
        // Try feed-specific articles first
        const { getLimit } = await import('@/v2/lib/display-settings');
        const data = await listFeedArticles(feedId, { limit: getLimit('previewArticleLimit') });
        if (data.total > 0) {
          setArticles(data.articles);
          setTotal(data.total);
          setLoading(false);
          return;
        }
      }
      // Fallback: search all ingested articles by query keywords
      if (query && query.layers.length > 0) {
        const data = await previewQuery(query);
        setArticles(data.articles);
        setTotal(data.total);
        onCountChange?.(data.total);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [feedId, query]);

  if (!feedId && (!query || query.layers.length === 0)) {
    return (
      <div className="text-center py-4 text-xs text-slate-400">
        Ajoutez des filtres pour voir l'aperçu
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-bold text-slate-900">
          Aperçu{total > 0 && ` (${total} articles)`}
        </h4>
        <button onClick={load} disabled={loading} className="p-1 text-slate-400 hover:text-[#42d3a5] transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-1.5">
        {articles.map((a, i) => (
          <button
            key={i}
            onClick={() => { const id = 'id' in a ? a.id : ''; if (id) openArticle(id); }}
            className="block w-full text-left p-2.5 rounded-lg border border-slate-100 hover:border-[#42d3a5]/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {'threat_level' in a && a.threat_level && (
                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${THREAT_COLORS[a.threat_level] || 'bg-slate-100 text-slate-500'}`}>
                  {a.threat_level}
                </span>
              )}
              <span className="text-[9px] font-semibold text-[#42d3a5]">{a.source_name}</span>
              <span className="text-[8px] text-slate-400 ml-auto">{a.published_at ? timeAgo(a.published_at) : ''}</span>
              {'relevance_score' in a && (
                <span className="text-[9px] font-bold text-blue-500">{Math.round(a.relevance_score)}%</span>
              )}
            </div>
            <p className="text-[11px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
            {a.summary && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{a.summary}</p>}
            {'entities' in a && a.entities && a.entities.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {a.entities.slice(0, 5).map((e, j) => (
                  <span key={j} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{e}</span>
                ))}
              </div>
            )}
          </button>
        ))}
        {articles.length === 0 && !loading && (
          <div className="text-center py-6 text-xs text-slate-400">
            {feedId ? 'Pas encore d\'articles — ajoutez des sources et lancez un refresh' : 'Aucun article trouvé — essayez d\'autres filtres'}
          </div>
        )}
        {loading && (
          <div className="text-center py-6 text-xs text-slate-400">
            Recherche d'articles en cours...
          </div>
        )}
      </div>
    </div>
  );
}
