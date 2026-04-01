// src/v2/components/ArticleReader.tsx
// Inoreader-style article reader — hero image, markdown content, action bar
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, ExternalLink, Loader2, AlertTriangle, Clock, Globe,
  Copy, ChevronRight, User, Building2, MapPin, Tag,
  Shield, FileText, Languages, ArrowUp, Bookmark, Heart,
  Share2, Pin, MessageSquare,
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
  medium: 'bg-yellow-500 text-[#b0bec9]',
  low: 'bg-blue-400 text-white',
  info: 'bg-slate-300 text-[#8899aa]',
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  negative: 'text-red-600 bg-red-50 border-red-200',
  neutral: 'text-slate-500 bg-[#1a2836] border-[#1e2d3d]',
};

const CRITICALITY_LABELS: Record<string, { label: string; cls: string }> = {
  breaking: { label: 'BREAKING', cls: 'bg-red-600 text-white animate-pulse' },
  developing: { label: 'EN COURS', cls: 'bg-amber-500 text-white' },
  background: { label: 'CONTEXTE', cls: 'bg-slate-200 text-[#8899aa]' },
};

function cleanMarkdown(md: string, heroImage: string | null): string {
  let clean = md;
  // Remove all markdown images (hero is shown separately)
  if (heroImage) {
    clean = clean.replace(/!\[[^\]]*\]\([^)]*\)\s*/g, '');
  }
  // Remove "Photograph: ..." credit lines (duplicated from caption)
  clean = clean.replace(/^.*Photograph:.*$/gm, '');
  // Remove duplicate consecutive blank lines
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

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

  // Hero image: prefer image_url (og:image), fallback to first markdown image
  const heroImage = data?.image_url || data?.content_md?.match(/!\[([^\]]*)\]\(([^)]+)\)/)?.[2] || null;
  const hasEntities = (data?.persons?.length || 0) + (data?.orgs?.length || 0) > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: '#131d2a' }} onClick={onClose} />

      {/* Centered overlay — Inoreader style */}
      <div className="fixed inset-0 z-50 flex justify-center overflow-hidden">
        <div className="w-full max-w-[760px] h-full flex flex-col" style={{ background: '#131d2a' }}>

        {/* ── Reading progress bar ── */}
        <div className="h-[3px] shrink-0" style={{ background: '#1e2d3d' }}>
          <div className="h-full transition-all duration-150" style={{ width: `${progress}%`, background: '#4d8cf5' }} />
        </div>

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-2 shrink-0" style={{ borderBottom: '1px solid #1e2d3d' }}>
          <div />
          <button onClick={onClose} className="p-1.5 rounded-md transition-colors" style={{ color: '#6b7d93' }}
            onMouseOver={e => { e.currentTarget.style.background = '#1a2836'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
            <X size={16} />
          </button>
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
              <div className="h-48 bg-[#1a2836] rounded-2xl animate-pulse mb-6" />
              <div className="h-7 w-4/5 bg-[#0f1923] rounded animate-pulse mb-3" />
              <div className="h-7 w-3/5 bg-[#0f1923] rounded animate-pulse mb-6" />
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-4 bg-[#1a2836] rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
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
                  <h1 className="text-2xl font-bold text-[#b0bec9] leading-snug tracking-tight">{data.title}</h1>
                  {data.description && <p className="text-base text-slate-500 leading-relaxed mt-4">{data.description}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── Article content — Inoreader layout ── */}
          {!loading && data && !data.error && (
            <>
              <div className="px-8 py-6 max-w-[700px] mx-auto">

                {/* Title — large, bold, white */}
                <h1 className="text-[24px] font-extrabold leading-[1.3] tracking-tight mb-3" style={{ color: '#e2e8f0' }}>
                  {data.title_translated || data.title}
                </h1>
                {data.title_translated && data.title !== data.title_translated && (
                  <p className="text-[13px] italic mb-2" style={{ color: '#6b7d93' }}>{data.title}</p>
                )}

                {/* Source + Author + Time — Inoreader style */}
                <div className="flex items-center gap-1.5 mb-4 text-[12px]">
                  <ExternalLink size={11} style={{ color: '#4d8cf5' }} />
                  <span className="font-medium" style={{ color: '#4d8cf5' }}>{formatSourceName(data.source_id)}</span>
                  {(data.author || (data as any).author) && (
                    <>
                      <span style={{ color: '#6b7d93' }}>·</span>
                      <span style={{ color: '#6b7d93' }}>par {(data as any).author || data.author}</span>
                    </>
                  )}
                  {data.pub_date && (
                    <>
                      <span style={{ color: '#6b7d93' }}>·</span>
                      <span style={{ color: '#6b7d93' }}>{formatDate(data.pub_date)}</span>
                    </>
                  )}
                </div>

                {/* Action bar — Inoreader icons */}
                <div className="flex items-center gap-1 mb-6 pb-4" style={{ borderBottom: '1px solid #1e2d3d' }}>
                  {[
                    { icon: Bookmark, title: 'Sauvegarder', color: data?.threat_level === 'critical' ? '#f59e0b' : '#6b7d93' },
                    { icon: Heart, title: 'Favori' },
                    { icon: MessageSquare, title: 'Annoter' },
                    { icon: Pin, title: 'Épingler' },
                    { icon: Share2, title: 'Partager' },
                    { icon: Copy, title: copied ? 'Copié !' : 'Copier le lien', onClick: handleCopy },
                  ].map((btn, i) => (
                    <button key={i} onClick={btn.onClick} title={btn.title}
                      className="p-2 rounded-md transition-colors" style={{ color: btn.color || '#6b7d93' }}
                      onMouseOver={e => { e.currentTarget.style.background = '#1a2836'; e.currentTarget.style.color = '#b0bec9'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = btn.color || '#6b7d93'; }}>
                      <btn.icon size={16} />
                    </button>
                  ))}
                  <div className="flex-1" />
                  {data.url && (
                    <a href={data.url} target="_blank" rel="noopener noreferrer" title="Ouvrir l'original"
                      className="p-2 rounded-md transition-colors" style={{ color: '#6b7d93' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#1a2836'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>

                {/* Hero image with caption */}
                {heroImage && (
                  <figure className="mb-6">
                    <div className="rounded-lg overflow-hidden" style={{ background: '#1a2836' }}>
                      <img src={heroImage} alt="" className="w-full object-cover" style={{ maxHeight: 400 }}
                        onError={e => { (e.target as HTMLImageElement).closest('figure')!.style.display = 'none'; }} />
                    </div>
                    <figcaption className="text-[11px] mt-2 px-1" style={{ color: '#6b7d93' }}>
                      {formatSourceName(data.source_id)}{(data as any).author ? ` / ${(data as any).author}` : ''}
                    </figcaption>
                  </figure>
                )}

                {/* Threat + sentiment badges (compact) */}
                {(data.threat_level || data.sentiment) && (
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    {data.threat_level && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded"
                        style={{ background: data.threat_level === 'critical' ? '#7f1d1d' : data.threat_level === 'high' ? '#7c2d12' : '#1a2836',
                                 color: data.threat_level === 'critical' ? '#fca5a5' : data.threat_level === 'high' ? '#fdba74' : '#6b7d93' }}>
                        <Shield size={10} />{data.threat_level}
                      </span>
                    )}
                    {data.sentiment && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded"
                        style={{ background: '#1a2836', color: data.sentiment === 'positive' ? '#22c55e' : data.sentiment === 'negative' ? '#ef4444' : '#6b7d93' }}>
                        {data.sentiment === 'positive' ? '↑' : data.sentiment === 'negative' ? '↓' : '→'} {data.sentiment}
                      </span>
                    )}
                    {data.lang && data.lang !== 'en' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded" style={{ background: '#1a2836', color: '#6b7d93' }}>
                        <Languages size={9} />{data.lang.toUpperCase()}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Full content ─────────────────────────── */}
                {data.content_md && (
                  <article className="max-w-none" style={{ color: '#c8d4e0', fontSize: 16, lineHeight: 1.85 }}>
                    <Markdown
                      components={{
                        h1: ({ children }) => (
                          <h1 style={{ color: '#e2e8f0', fontSize: 22, fontWeight: 800, marginTop: 32, marginBottom: 16, lineHeight: 1.3 }}>{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 style={{ color: '#e2e8f0', fontSize: 19, fontWeight: 700, marginTop: 28, marginBottom: 12, lineHeight: 1.3 }}>{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 style={{ color: '#e2e8f0', fontSize: 17, fontWeight: 700, marginTop: 24, marginBottom: 10, lineHeight: 1.3 }}>{children}</h3>
                        ),
                        p: ({ children }) => (
                          <p style={{ marginTop: 16, marginBottom: 16 }}>{children}</p>
                        ),
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            style={{ color: '#4d8cf5', fontWeight: 500, textDecoration: 'none' }}
                            onMouseOver={e => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                            onMouseOut={e => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                          >{children}</a>
                        ),
                        strong: ({ children }) => (
                          <strong style={{ color: '#e2e8f0', fontWeight: 600 }}>{children}</strong>
                        ),
                        em: ({ children }) => (
                          <em style={{ color: '#9aafca', fontStyle: 'italic' }}>{children}</em>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote style={{
                            borderLeft: '3px solid #4d8cf5', background: '#1a2836',
                            borderRadius: '0 12px 12px 0', padding: '12px 20px', margin: '20px 0',
                            color: '#9aafca', fontSize: 15, fontStyle: 'italic',
                          }}>{children}</blockquote>
                        ),
                        ul: ({ children }) => (
                          <ul style={{ paddingLeft: 20, margin: '12px 0' }}>{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol style={{ paddingLeft: 20, margin: '12px 0' }}>{children}</ol>
                        ),
                        li: ({ children }) => (
                          <li style={{ marginBottom: 6 }}>{children}</li>
                        ),
                        hr: () => (
                          <hr style={{ border: 'none', borderTop: '1px solid #1e2d3d', margin: '28px 0' }} />
                        ),
                        img: ({ src, alt }) => (
                          <figure style={{ margin: '24px 0' }}>
                            <img src={src} alt={alt || ''} loading="lazy"
                              style={{ width: '100%', borderRadius: 12, maxHeight: 500, objectFit: 'cover' }}
                              onError={e => { (e.target as HTMLImageElement).closest('figure')!.style.display = 'none'; }} />
                            {alt && alt.length > 3 && (
                              <figcaption style={{ textAlign: 'center', fontSize: 11, color: '#6b7d93', marginTop: 8 }}>{alt}</figcaption>
                            )}
                          </figure>
                        ),
                      }}
                    >
                      {cleanMarkdown(data.content_md, heroImage)}
                    </Markdown>
                  </article>
                )}

                {/* Fallback description */}
                {!data.content_md && data.description && (
                  <div className="mt-2">
                    <p className="text-[15px] leading-[1.8]" style={{ color: '#8899aa' }}>{data.description}</p>
                  </div>
                )}

                {/* Read full article — always visible */}
                {data.url && (
                  <div className="mt-8 pt-6" style={{ borderTop: '1px solid #1e2d3d' }}>
                    <a href={data.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[14px] font-semibold transition-colors"
                      style={{ color: '#4d8cf5' }}
                      onMouseOver={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseOut={e => { e.currentTarget.style.textDecoration = 'none'; }}>
                      <ExternalLink size={14} />
                      Read full article
                    </a>
                  </div>
                )}

                {/* Comments placeholder */}
                <div className="mt-6 pt-4" style={{ borderTop: '1px solid #1e2d3d' }}>
                  <button className="flex items-center gap-2 text-[12px] font-medium" style={{ color: '#6b7d93' }}>
                    <MessageSquare size={14} /> Ajouter ses mots
                  </button>
                </div>

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
            className="absolute bottom-16 right-6 p-2.5 bg-[#1a2836] text-slate-400 rounded-full shadow-lg border border-[#1e2d3d] hover:text-[#8899aa] transition-colors z-10"
          >
            <ArrowUp size={16} />
          </button>
        )}

        </div>
      </div>
    </>
  );
}
