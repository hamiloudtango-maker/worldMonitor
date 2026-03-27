// src/v2/components/ArticleReader.tsx
import { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import Markdown from 'react-markdown';
import { getArticleContent } from '@/v2/lib/article-api';
import type { ArticleContent } from '@/v2/lib/article-api';

interface Props {
  articleId: string | null;
  onClose: () => void;
}

export default function ArticleReader({ articleId, onClose }: Props) {
  const [data, setData] = useState<ArticleContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!articleId) { setData(null); return; }
    setLoading(true);
    setData(null);
    getArticleContent(articleId)
      .then(setData)
      .catch(() => setData({ content_md: null, url: '', title: '', error: 'Erreur de chargement', cached: false }))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (!articleId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[55%] md:w-[50%] lg:w-[45%] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-slide-in">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="h-5 w-3/4 bg-slate-100 rounded animate-pulse" />
            ) : (
              <h2 className="text-sm font-bold text-slate-900 leading-snug">
                {data?.title || 'Article'}
              </h2>
            )}
            {data?.source_id && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{data.source_id}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {data?.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-slate-50 transition-colors"
                title="Ouvrir l'original"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Scraping en cours...
              </div>
              {/* Skeleton */}
              <div className="space-y-2.5 mt-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3.5 bg-slate-100 rounded animate-pulse"
                    style={{ width: `${60 + Math.random() * 40}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && data?.error && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Impossible de scraper cet article</p>
                <p className="text-xs text-amber-600 mt-1">{data.error}</p>
                {data.url && (
                  <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    Ouvrir l'article original
                  </a>
                )}
              </div>
            </div>
          )}

          {!loading && data?.content_md && (
            <article className="prose prose-sm prose-slate max-w-none
              prose-headings:text-slate-900 prose-headings:font-bold
              prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
              prose-p:text-slate-700 prose-p:leading-relaxed
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-img:rounded-lg prose-img:max-h-64
              prose-blockquote:border-l-slate-300 prose-blockquote:text-slate-600
              prose-code:text-xs prose-code:bg-slate-50 prose-code:px-1 prose-code:rounded
            ">
              <Markdown>{data.content_md}</Markdown>
            </article>
          )}
        </div>

        {/* Footer */}
        {data?.cached !== undefined && !loading && data?.content_md && (
          <div className="px-5 py-2 border-t border-slate-100 text-[10px] text-slate-400 shrink-0">
            {data.cached ? 'Contenu en cache' : 'Fraichement scrappe'}
          </div>
        )}
      </div>
    </>
  );
}
