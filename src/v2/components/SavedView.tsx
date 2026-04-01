// src/v2/components/SavedView.tsx
// Inoreader /starred — Saved articles manager with sub-navigation
import { useState, useEffect, useContext } from 'react';
import {
  BookmarkPlus, Archive, MessageSquareQuote, Globe, Download,
  FileText, Tag, Settings, Search, Plus, Trash2, MoreHorizontal,
  ChevronDown, ChevronUp, Bookmark,
} from 'lucide-react';
import { listReadLater, listStarred, toggleReadLater, toggleStar, type ArticleSummary } from '@/v2/lib/sources-api';
import { ArticleReaderContext } from '@/v2/hooks/useArticleReader';
import { useTheme } from '@/v2/lib/theme';

type SubNav = 'read-later' | 'archive' | 'annotations' | 'pages' | 'downloads' | 'reports';

const SUB_NAV: { key: SubNav; label: string; icon: typeof BookmarkPlus }[] = [
  { key: 'read-later',  label: 'Lire plus tard',              icon: BookmarkPlus },
  { key: 'archive',     label: 'Archive',                     icon: Archive },
  { key: 'annotations', label: 'Annotations',                 icon: MessageSquareQuote },
  { key: 'pages',       label: 'Pages web',                   icon: Globe },
  { key: 'downloads',   label: 'Chargements',                 icon: Download },
  { key: 'reports',     label: 'Rapports de renseignement',   icon: FileText },
];

function formatSource(s: string) {
  return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
}

function estimateReadTime(desc?: string): string {
  if (!desc) return '--:--';
  const words = desc.split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${String(mins).padStart(2, '0')}:00`;
}

export default function SavedView() {
  const { t } = useTheme();
  const [sub, setSub] = useState<SubNav>('read-later');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'continue'>('all');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const onOpenArticle = useContext(ArticleReaderContext);

  const stubTabs: SubNav[] = ['annotations', 'pages', 'downloads', 'reports'];

  useEffect(() => {
    if (stubTabs.includes(sub)) { setArticles([]); setLoading(false); return; }
    setLoading(true);
    const fetcher = sub === 'read-later' ? listReadLater(100) : listStarred(100);
    fetcher.then(d => setArticles(d.articles)).catch(() => setArticles([])).finally(() => setLoading(false));
  }, [sub]);

  const filtered = articles.filter(a => {
    if (!search) return true;
    return a.title.toLowerCase().includes(search.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = new Date(a.pub_date || 0).getTime();
    const db = new Date(b.pub_date || 0).getTime();
    return sortDir === 'desc' ? db - da : da - db;
  });

  return (
    <div className="flex h-full" style={{ background: t.bgApp }}>
      {/* Left sub-nav */}
      <div className="w-[200px] shrink-0 py-4 overflow-y-auto" style={{ borderRight: `1px solid ${t.border}` }}>
        <h6 className="text-[11px] font-bold uppercase tracking-wider px-4 mb-3" style={{ color: t.textSecondary }}>Enregistré</h6>
        {SUB_NAV.map(item => {
          const isActive = item.key === sub;
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => setSub(item.key)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors"
              style={{ background: isActive ? `${t.accent}12` : 'transparent', color: isActive ? t.accent : t.textSecondary }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = `${t.accent}08`; }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = isActive ? `${t.accent}12` : 'transparent'; }}
            >
              <Icon size={14} />
              <span className="text-[12px] font-medium flex-1">{item.label}</span>
              {item.key === 'read-later' && articles.length > 0 && isActive && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${t.accent}20`, color: t.accent }}>{articles.length}</span>
              )}
            </button>
          );
        })}

        <div className="mt-6 px-4">
          <div className="flex items-center justify-between mb-2">
            <h6 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textSecondary }}>\Étiquettes</h6>
            <div className="flex items-center gap-1">
              <button className="p-1 rounded" style={{ color: t.textSecondary }}><Settings size={12} /></button>
              <button className="p-1 rounded" style={{ color: t.textSecondary }}><Tag size={12} /></button>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: t.textSecondary }}>Aucune étiquette</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] font-bold" style={{ color: t.textHeading }}>
              {SUB_NAV.find(n => n.key === sub)?.label || 'Lire plus tard'}
            </h2>
            <ChevronDown size={16} style={{ color: t.textSecondary }} />
          </div>
        </div>

        {/* Toolbar: tabs + search + actions */}
        <div className="flex items-center justify-between px-6 pb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterTab('all')}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={{ background: filterTab === 'all' ? t.accent : 'transparent', color: filterTab === 'all' ? '#fff' : t.textSecondary }}>
              Tous
            </button>
            <button onClick={() => setFilterTab('continue')}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={{ background: filterTab === 'continue' ? t.accent : 'transparent', color: filterTab === 'continue' ? '#fff' : t.textSecondary, border: filterTab === 'continue' ? 'none' : `1px solid ${t.border}` }}>
              Continuer la lecture
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
              <Search size={14} className="ml-2.5" style={{ color: t.textSecondary }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search in articles" className="px-2 py-1.5 text-[12px] bg-transparent outline-none w-40"
                style={{ color: t.textPrimary }} />
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ border: `1px solid ${t.border}`, color: t.textPrimary }}>
              <Plus size={13} /> Ajouter
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ border: `1px solid ${t.border}`, color: t.textPrimary }}>
              <Archive size={13} /> Archiver tout
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="grid px-6 py-2 text-[10px] font-bold uppercase tracking-wider"
          style={{ gridTemplateColumns: '1fr 140px 100px 100px 180px 80px', color: t.textSecondary, borderBottom: `1px solid ${t.border}` }}>
          <span></span>
          <span>Source</span>
          <span>Longueur</span>
          <span>Avancement</span>
          <button className="flex items-center gap-1" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
            Date de sauvegarde {sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>
          <span></span>
        </div>

        {/* Articles */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${t.accent} transparent transparent transparent` }} />
          </div>
        ) : stubTabs.includes(sub) ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
              {sub === 'annotations' && <MessageSquareQuote size={28} style={{ color: t.accent, opacity: 0.5 }} />}
              {sub === 'pages' && <Globe size={28} style={{ color: t.accent, opacity: 0.5 }} />}
              {sub === 'downloads' && <Download size={28} style={{ color: t.accent, opacity: 0.5 }} />}
              {sub === 'reports' && <FileText size={28} style={{ color: t.accent, opacity: 0.5 }} />}
            </div>
            <p className="text-[14px] font-semibold mb-1" style={{ color: t.textHeading }}>{SUB_NAV.find(n => n.key === sub)?.label}</p>
            <p className="text-[12px]" style={{ color: t.textSecondary }}>Fonctionnalité en cours de développement</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[13px]" style={{ color: t.textSecondary }}>Aucun article ici.</p>
          </div>
        ) : (
          sorted.map(a => (
            <div key={a.id} className="grid items-center px-6 py-2.5 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: '1fr 140px 100px 100px 180px 80px', borderBottom: `1px solid ${t.border}` }}
              onClick={() => onOpenArticle?.(a.id)}
              onMouseOver={e => { e.currentTarget.style.background = '#1a2d3f'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Title + thumbnail */}
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <div className="w-14 h-10 rounded-md overflow-hidden shrink-0" style={{ background: t.bgCard }}>
                  {a.image_url && <img src={a.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <span className="text-[13px] font-medium truncate" style={{ color: t.textHeading }}>{a.title}</span>
              </div>
              {/* Source */}
              <span className="text-[12px] truncate" style={{ color: t.accent }}>{formatSource(a.source_id)}</span>
              {/* Length */}
              <span className="text-[12px]" style={{ color: t.textSecondary }}>{estimateReadTime(a.description)}</span>
              {/* Progress */}
              <span className="text-[12px]" style={{ color: t.textSecondary }}>0 %</span>
              {/* Date */}
              <span className="text-[12px]" style={{ color: t.textSecondary }}>{a.pub_date ? new Date(a.pub_date).toLocaleDateString('fr-FR', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}</span>
              {/* Actions */}
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button className="p-1 rounded" style={{ color: '#f59e0b' }} title="Starred"
                  onClick={() => { toggleStar(a.id).catch(() => {}); }}><Bookmark size={13} /></button>
                <button className="p-1 rounded" style={{ color: t.textSecondary }} title="Retirer"
                  onClick={() => { toggleReadLater(a.id).then(() => setArticles(prev => prev.filter(x => x.id !== a.id))).catch(() => {}); }}><Trash2 size={13} /></button>
                <button className="p-1 rounded" style={{ color: t.textSecondary }}><MoreHorizontal size={13} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
