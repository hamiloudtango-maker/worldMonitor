// src/v2/components/ArticleReader.tsx
// Inoreader-inspired article reader — clean, airy, image-first
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ExternalLink, Loader2, AlertTriangle, Clock, Globe,
  Copy, ChevronRight, User, Building2, MapPin, Tag,
  Shield, FileText, Languages, ArrowUp,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { getArticleContent } from '@/v2/lib/article-api';
import type { ArticleContent } from '@/v2/lib/article-api';

interface Props {
  articleId: string | null;
  onClose: () => void;
}

const THREAT_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-slate-900',
  low: 'bg-blue-400 text-white',
  info: 'bg-slate-300 text-slate-700',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  negative: 'text-red-600 bg-red-50 border-red-200',
  neutral: 'text-slate-500 bg-slate-50 border-slate-200',
};

const CRITICALITY_LABELS: Record<string, { label: string; cls: string }> = {
  breaking: { label: 'BREAKING', cls: 'bg-red-600 text-white animate-pulse' },
  developing: { label: 'EN COURS', cls: 'bg-amber-500 text-white' },
  background: { label: 'CONTEXTE', cls: 'bg-slate-200 text-slate-600' },
};

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600000;
  if (diffH < 1) return `il y a ${Math.max(1, Math.floor(diffH * 60))} min`;
  if (diffH < 24) return `il y a ${Math.floor(diffH)}h`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatSourceName(sourceId?: string) {
  if (!sourceId) return 'Source inconnue';
  return sourceId
    .replace(/^catalog_|^gnews_|^gdelt_|^case_|^rss_|^plugin_rss_|^plugin_\w+_/g, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function ArticleReader({ articleId, onClose }: Props) {
  const [data, setData] = useState<ArticleContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!articleId) { setData(null); setProgress(0); return; }
    setLoading(true);
    setData(null);
    setProgress(0);
    getArticleContent(articleId)
      .then(setData)
      .catch(() => setData({
        content_md: null, url: '', title: '', id: '', hash: '',
        tags: [], persons: [], orgs: [], countries: [], countries_mentioned: [],
        error: 'Erreur de chargement', cached: false,
      }))
      .finally(() => setLoading(false));
  }, [articleId]);

  // Reading progress bar
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pct = el.scrollHeight - el.clientHeight;
    setProgress(pct > 0 ? Math.min(100, (el.scrollTop / pct) * 100) : 0);
    setShowScrollTop(el.scrollTop > 400);
  }, []);

  const handleCopy = useCallback(() => {
    if (data?.url) {
      navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data?.url]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!articleId) return null;

  // Extract first image from markdown for hero
  const heroImage = data?.content_md?.match(/!\[([^\]]*)\]\(([^)]+)\)/)?.[2];
  const hasEntities = (data?.persons?.length || 0) + (data?.orgs?.length || 0) > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[62%] md:w-[56%] lg:w-[50%] xl:w-[44%] bg-white z-50 flex flex-col shadow-2xl">

        {/* ── Reading progress bar ──────────────────────── */}
        <div className="h-[3px] bg-slate-100 shrink-0">
          <div
            className="h-full bg-gradient-to-r from-[#42d3a5] to-[#36b891] transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Minimal top bar ────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2 shrink-0 border-b border-slate-100/80">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 min-w-0">
            <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center shrink-0">
              <Globe size={11} className="text-slate-400" />
            </div>
            <span className="font-medium text-slate-600 truncate max-w-[180px]">
              {formatSourceName(data?.source_id)}
            </span>
            {data?.pub_date && (
              <>
                <span className="text-slate-200">·</span>
                <span>{formatDate(data.pub_date)}</span>
              </>
            )}
            {data?.reading_time_min && (
              <>
                <span className="text-slate-200">·</span>
                <span className="flex items-center gap-0.5"><Clock size={10} />{data.reading_time_min} min</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-300 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors"
              title={copied ? 'Copié !' : 'Copier le lien'}
            >
              <Copy size={13} />
            </button>
            {data?.url && (
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-300 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors" title="Original">
                <ExternalLink size={13} />
              </a>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors ml-1">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Scrollable article ─────────────────────────── */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto scroll-smooth">

          {/* Loading */}
          {loading && (
            <div className="px-8 py-10">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
                <Loader2 size={16} className="animate-spin" />
                Extraction du contenu...
              </div>
              <div className="h-48 bg-slate-50 rounded-2xl animate-pulse mb-6" />
              <div className="h-7 w-4/5 bg-slate-100 rounded animate-pulse mb-3" />
              <div className="h-7 w-3/5 bg-slate-100 rounded animate-pulse mb-6" />
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-4 bg-slate-50 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && data?.error && (
            <div className="px-8 py-10">
              <div className="flex items-start gap-3 p-5 bg-amber-50/80 border border-amber-100 rounded-2xl">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Contenu indisponible</p>
                  <p className="text-xs text-amber-600 mt-1">{data.error}</p>
                  {data.url && (
                    <a href={data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2">
                      Ouvrir l'original <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
              {data.title && (
                <div className="mt-6">
                  <h1 className="text-2xl font-bold text-slate-900 leading-snug tracking-tight">{data.title}</h1>
                  {data.description && <p className="text-base text-slate-500 leading-relaxed mt-4">{data.description}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── Article content ──────────────────────────── */}
          {!loading && data && !data.error && (
            <>
              {/* Hero image */}
              {heroImage && (
                <div className="w-full bg-slate-50">
                  <img
                    src={heroImage}
                    alt=""
                    className="w-full max-h-[320px] object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}

              <div className="px-8 py-6 max-w-[680px] mx-auto">

                {/* Criticality badge */}
                {data.criticality && CRITICALITY_LABELS[data.criticality] && (
                  <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md mb-4 ${CRITICALITY_LABELS[data.criticality].cls}`}>
                    {CRITICALITY_LABELS[data.criticality].label}
                  </span>
                )}

                {/* Title */}
                <h1 className="text-[26px] font-extrabold text-slate-900 leading-[1.25] tracking-tight mb-2">
                  {data.title_translated || data.title}
                </h1>
                {data.title_translated && data.title !== data.title_translated && (
                  <p className="text-sm text-slate-400 italic mb-1">{data.title}</p>
                )}

                {/* Metadata line */}
                <div className="flex flex-wrap items-center gap-2 mt-4 mb-6">
                  {data.threat_level && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded ${THREAT_COLORS[data.threat_level]}`}>
                      <Shield size={10} />{data.threat_level}
                    </span>
                  )}
                  {data.sentiment && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border ${SENTIMENT_COLORS[data.sentiment] || ''}`}>
                      {data.sentiment === 'positive' ? '↑' : data.sentiment === 'negative' ? '↓' : '→'} {data.sentiment}
                    </span>
                  )}
                  {data.family && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-600">
                      <FileText size={9} />{data.family}{data.section && <><ChevronRight size={8} />{data.section}</>}
                    </span>
                  )}
                  {data.lang && data.lang !== 'en' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-slate-500 bg-slate-50 rounded">
                      <Languages size={9} />{data.lang.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Countries */}
                {data.countries?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-5">
                    <MapPin size={11} className="text-slate-300" />
                    {data.countries.map(c => (
                      <span key={c} className="px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-50 rounded border border-slate-100">{c}</span>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {data.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {data.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-100">
                        <Tag size={8} />{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Summary */}
                {data.summary && (
                  <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-5 mb-8 border border-slate-100">
                    <div className="absolute top-4 left-5 w-6 h-6 rounded-lg bg-white shadow-sm flex items-center justify-center">
                      <span className="text-[10px]">✨</span>
                    </div>
                    <div className="pl-9">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">Résumé IA</p>
                      <p className="text-[13px] text-slate-700 leading-relaxed">{data.summary}</p>
                    </div>
                  </div>
                )}

                {/* Entities */}
                {hasEntities && (
                  <div className="grid grid-cols-2 gap-3 mb-8">
                    {data.persons && data.persons.length > 0 && (
                      <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                        <p className="text-[9px] uppercase font-bold text-blue-400 tracking-wider mb-2 flex items-center gap-1">
                          <User size={9} />Personnes
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {data.persons.slice(0, 8).map(p => (
                            <span key={p} className="px-1.5 py-0.5 bg-white text-blue-700 text-[10px] rounded shadow-sm">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.orgs && data.orgs.length > 0 && (
                      <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100/60">
                        <p className="text-[9px] uppercase font-bold text-violet-400 tracking-wider mb-2 flex items-center gap-1">
                          <Building2 size={9} />Organisations
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {data.orgs.slice(0, 8).map(o => (
                            <span key={o} className="px-1.5 py-0.5 bg-white text-violet-700 text-[10px] rounded shadow-sm">{o}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Separator */}
                <hr className="border-slate-100 mb-8" />

                {/* ── Full content ─────────────────────────── */}
                {data.content_md && (
                  <article className="
                    prose prose-slate max-w-none
                    prose-headings:text-slate-900 prose-headings:font-bold prose-headings:tracking-tight
                    prose-h1:text-[22px] prose-h1:mt-10 prose-h1:mb-4
                    prose-h2:text-[18px] prose-h2:mt-8 prose-h2:mb-3
                    prose-h3:text-[15px] prose-h3:mt-6 prose-h3:mb-2
                    prose-p:text-[15px] prose-p:text-slate-700 prose-p:leading-[1.8] prose-p:my-4
                    prose-a:text-[#42d3a5] prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-slate-900 prose-strong:font-semibold
                    prose-blockquote:border-l-[3px] prose-blockquote:border-[#42d3a5] prose-blockquote:bg-slate-50/70
                    prose-blockquote:rounded-r-xl prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:my-6
                    prose-blockquote:not-italic prose-blockquote:text-[14px] prose-blockquote:text-slate-600
                    prose-code:text-xs prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                    prose-li:text-[15px] prose-li:text-slate-700 prose-li:leading-[1.7]
                    prose-ul:my-4 prose-ol:my-4
                    prose-hr:border-slate-100 prose-hr:my-8
                    prose-img:rounded-2xl prose-img:shadow-sm prose-img:my-6
                  ">
                    <Markdown
                      components={{
                        img: ({ src, alt, ...props }) => (
                          <figure className="my-8">
                            <img
                              src={src}
                              alt={alt || ''}
                              loading="lazy"
                              className="rounded-2xl shadow-md w-full object-cover max-h-[500px]"
                              onError={(e) => { (e.target as HTMLImageElement).closest('figure')!.style.display = 'none'; }}
                              {...props}
                            />
                            {alt && alt.length > 3 && (
                              <figcaption className="text-center text-[11px] text-slate-400 mt-3 px-4">{alt}</figcaption>
                            )}
                          </figure>
                        ),
                        a: ({ href, children, ...props }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                        ),
                      }}
                    >
                      {data.content_md}
                    </Markdown>
                  </article>
                )}

                {/* Fallback description */}
                {!data.content_md && data.description && (
                  <div className="mt-2">
                    <p className="text-[15px] text-slate-600 leading-[1.8]">{data.description}</p>
                    {data.url && (
                      <a href={data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#42d3a5] font-medium hover:underline mt-4">
                        Lire l'article complet <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                )}

                {/* Bottom spacer */}
                <div className="h-16" />
              </div>
            </>
          )}
        </div>

        {/* ── Scroll to top button ──────────────────────── */}
        {showScrollTop && (
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="absolute bottom-16 right-6 p-2.5 bg-white text-slate-400 rounded-full shadow-lg border border-slate-200 hover:text-slate-600 transition-colors z-10"
          >
            <ArrowUp size={16} />
          </button>
        )}

        {/* ── Bottom bar ────────────────────────────────── */}
        {data && !loading && (
          <div className="flex items-center justify-between px-5 py-2 border-t border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              {data.word_count && <span>{data.word_count.toLocaleString('fr-FR')} mots</span>}
              {data.cached !== undefined && (
                <span className="text-slate-300">{data.cached ? '● cache' : '● extrait'}</span>
              )}
            </div>
            {data.url && (
              <a
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[#42d3a5] rounded-lg hover:bg-[#36b891] transition-colors shadow-sm"
              >
                <ExternalLink size={11} />
                Ouvrir l'original
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );
}
