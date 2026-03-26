// src/v2/components/ai-feeds/FeedPreview.tsx
import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { listFeedArticles } from '@/v2/lib/ai-feeds-api';
import type { AIFeedArticle } from '@/v2/lib/ai-feeds-api';
import { timeAgo } from '@/v2/lib/constants';

interface Props {
  feedId: string | null;
}

const THREAT_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-600',
  high: 'bg-orange-100 text-orange-600',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-600',
};

export default function FeedPreview({ feedId }: Props) {
  const [articles, setArticles] = useState<AIFeedArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!feedId) return;
    setLoading(true);
    try {
      const data = await listFeedArticles(feedId, { limit: 10 });
      setArticles(data.articles);
      setTotal(data.total);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [feedId]);

  if (!feedId) {
    return (
      <div className="text-center py-4 text-xs text-slate-400">
        Sélectionnez un feed pour voir l'aperçu
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-bold text-slate-900">
          Aperçu ({total} articles)
        </h4>
        <button onClick={load} disabled={loading} className="p-1 text-slate-400 hover:text-[#42d3a5] transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-1.5">
        {articles.map(a => (
          <a
            key={a.id}
            href={a.article_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2.5 rounded-lg border border-slate-100 hover:border-[#42d3a5]/30 transition-colors"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {a.threat_level && (
                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${THREAT_COLORS[a.threat_level] || 'bg-slate-100 text-slate-500'}`}>
                  {a.threat_level}
                </span>
              )}
              <span className="text-[9px] font-semibold text-[#42d3a5]">{a.source_name}</span>
              <span className="text-[8px] text-slate-400 ml-auto">{a.published_at ? timeAgo(a.published_at) : ''}</span>
              <span className="text-[9px] font-bold text-blue-500">{Math.round(a.relevance_score)}%</span>
            </div>
            <p className="text-[11px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
            {a.summary && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{a.summary}</p>}
            {a.entities && a.entities.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {a.entities.slice(0, 5).map((e, i) => (
                  <span key={i} className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{e}</span>
                ))}
              </div>
            )}
          </a>
        ))}
        {articles.length === 0 && !loading && (
          <div className="text-center py-6 text-xs text-slate-400">
            Pas encore d'articles — ajoutez des sources et lancez un refresh
          </div>
        )}
      </div>
    </div>
  );
}
