import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  LayoutDashboard, FolderOpen, FileBarChart, Settings,
  Globe, Newspaper, Rss, Zap, Search, RefreshCw, LogOut,
  TrendingUp, Star, BookmarkPlus, AlertTriangle, Activity,
  BarChart2, Building, Plus, ChevronDown, ChevronUp,
  MoreHorizontal, ExternalLink, Eye,
} from 'lucide-react';
import type { CaseData } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';
import { timeAgo } from '@/v2/lib/constants';
import { useCases } from '@/v2/hooks/useCases';
import { DataProvider, useGlobalData } from '@/v2/hooks/useData';
import { api } from '@/v2/lib/api';
import { listStarred, listReadLater, getTrending, type ArticleSummary } from '@/v2/lib/sources-api';
import { getDisplaySettings as getDisplaySettingsFn, setDisplaySettings as setDisplaySettingsFn } from '@/v2/lib/display-settings';
import CasesView from './CasesView';
import WorldView from './WorldView';
import AIFeedsView from './AIFeedsView';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import SourceManager from './SourceManager';
import ApiServices from './ApiServices';
import IntelModelsManager from './IntelModelsManager';
import ReportsView from './ReportsView';
import ReaderView from './ReaderView';
import AutomateView from './AutomateView';
import SearchPageView from './SearchPageView';
import ArticleReader from './ArticleReader';
import { ArticleReaderContext } from '@/v2/hooks/useArticleReader';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface Props {
  user: { email: string; org_name: string };
  onLogout: () => void;
}
type NavKey = 'dashboard' | 'reader' | 'cases' | 'ai-feeds' | 'world' | 'automate' | 'search-page' | 'reports' | 'settings';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS — Inoreader dark theme tokens
   ═══════════════════════════════════════════════════════════════ */
const BG_APP       = '#131d2a';
const BG_SIDEBAR   = '#0f1923';
const BG_CARD      = '#1a2836';
const ACCENT       = '#4d8cf5';
const TEXT_PRIMARY  = '#b0bec9';
const TEXT_SECONDARY= '#6b7d93';
const TEXT_HEADING  = '#e2e8f0';
const BORDER       = '#1e2d3d';

const NAV_ITEMS: { key: NavKey; label: string; icon: typeof LayoutDashboard; sep?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboards',      icon: LayoutDashboard },
  { key: 'reader',    label: 'Feeds',           icon: Newspaper },
  { key: 'cases',     label: 'Cases',           icon: FolderOpen },
  { key: 'ai-feeds',  label: 'AI Feeds',        icon: Rss },
  { key: 'automate',  label: 'Automate',        icon: Zap },
  { key: 'search-page', label: 'Recherche',     icon: Search },
  { key: 'world',     label: '360°',            icon: Globe },
  { key: 'reports',   label: 'Rapports',        icon: FileBarChart },
  { key: 'settings',  label: 'Config',          icon: Settings, sep: true },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function getNavFromHash(): NavKey {
  const raw = window.location.hash.replace('#', '').split(':')[0];
  const valid: NavKey[] = ['dashboard', 'reader', 'cases', 'ai-feeds', 'world', 'automate', 'search-page', 'reports', 'settings'];
  return valid.includes(raw as NavKey) ? (raw as NavKey) : 'dashboard';
}

export default function Dashboard(props: Props) {
  return (
    <DataProvider>
      <DashboardInner {...props} />
    </DataProvider>
  );
}

function DashboardInner({ user, onLogout }: Props) {
  const [nav, _setNav] = useState<NavKey>(getNavFromHash);
  const setNav = useCallback((key: NavKey) => {
    window.location.hash = key;
    _setNav(key);
  }, []);

  useEffect(() => {
    const onHash = () => _setNav(getNavFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const { articles, stats, loading, refresh: load } = useGlobalData();
  const { cases, loading: casesLoading, add: addCase, remove: removeCase } = useCases();
  const [readingArticleId, setReadingArticleId] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const alertCount = useMemo(() =>
    articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high').length
  , [articles]);

  return (
    <ArticleReaderContext.Provider value={setReadingArticleId}>
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", background: BG_APP, color: TEXT_PRIMARY }}>

      {/* ───────── SIDEBAR (Inoreader: dark, icons + labels) ───────── */}
      <aside
        className="flex flex-col shrink-0 z-10 transition-all duration-200"
        style={{ background: BG_SIDEBAR, width: sidebarExpanded ? 220 : 52, borderRight: `1px solid ${BORDER}` }}
      >
        <div className="h-14 flex items-center justify-center shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366f1)` }}>
            <Globe size={15} className="text-white" />
          </div>
          {sidebarExpanded && (
            <div className="ml-2.5 leading-tight">
              <div className="font-extrabold text-[12px] tracking-tight" style={{ color: TEXT_PRIMARY }}>WorldMonitor</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 space-y-0.5 overflow-y-auto px-1.5">
          {NAV_ITEMS.map(item => {
            const isActive = nav === item.key;
            return (
              <div key={item.key}>
                {item.sep && <div className="my-2 mx-1" style={{ borderTop: `1px solid ${BORDER}` }} />}
                <button
                  onClick={() => setNav(item.key)}
                  className="w-full flex flex-col items-center rounded-lg transition-all relative"
                  style={{
                    padding: '8px 4px 5px',
                    background: isActive ? `${ACCENT}18` : 'transparent',
                    color: isActive ? ACCENT : TEXT_SECONDARY,
                  }}
                  title={item.label}
                >
                  <item.icon size={20} />
                  <span className="text-[9px] font-medium mt-1 truncate w-full text-center">{item.label}</span>
                  {item.key === 'reader' && alertCount > 0 && (
                    <span className="absolute bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, top: 2, right: 2 }}>
                      {Math.min(alertCount, 99)}
                    </span>
                  )}
                  {item.key === 'cases' && cases.length > 0 && (
                    <span className="absolute text-white text-[8px] font-bold rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, top: 2, right: 2, background: ACCENT }}>
                      {cases.length}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 pb-3" style={{ padding: sidebarExpanded ? '0 8px 12px' : '0 6px 12px', borderTop: `1px solid ${BORDER}` }}>
          <div className="pt-3">
            <NotificationBell onOpenArticle={setReadingArticleId} />
          </div>
          <div className="flex items-center justify-center py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white cursor-pointer" style={{ background: '#e91e8c' }} title={user.email} onClick={onLogout}>
              {user.org_name.charAt(0).toUpperCase()}
            </div>
          </div>
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-full flex items-center justify-center py-1.5 rounded transition-colors"
            style={{ color: TEXT_SECONDARY }}
          >
            {sidebarExpanded ? '«' : '»'}
          </button>
        </div>
      </aside>

      {/* ───────── MAIN ───────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">

          {/* Dashboard — Inoreader /dashboard: single scrollable column with stacked widgets */}
          {nav === 'dashboard' && (
            <DashboardView
              articles={articles}
              stats={stats}
              cases={cases}
              loading={loading}
              onRefresh={load}
              onOpenArticle={setReadingArticleId}
            />
          )}

          {nav === 'reader' && <ReaderView />}

          {nav !== 'reader' && nav !== 'dashboard' && (
            <div className="h-full overflow-y-auto" style={{ background: BG_APP }}>
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-[22px] font-bold" style={{ color: TEXT_HEADING }}>
                    {NAV_ITEMS.find(n => n.key === nav)?.label || ''}
                  </h1>
                  {!loading && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: '#0f2d1a', color: '#22c55e' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <GlobalSearch />
                  <button onClick={load} className="p-2 rounded-lg transition-colors" style={{ color: TEXT_SECONDARY }} title="Actualiser">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                {nav === 'cases' && <CasesView cases={cases} loading={casesLoading} onAdd={addCase} onRemove={removeCase} />}
                {nav === 'ai-feeds' && <AIFeedsView />}
                {nav === 'automate' && <AutomateView />}
                {nav === 'search-page' && <SearchPageView />}
                {nav === 'world' && <WorldView />}
                {nav === 'reports' && <ReportsView />}
                {nav === 'settings' && <SettingsView user={user} stats={stats} cases={cases} onLogout={onLogout} />}
              </div>
            </div>
          )}
        </div>
      </main>

      <ArticleReader articleId={readingArticleId} onClose={() => setReadingArticleId(null)} />
    </div>
    </ArticleReaderContext.Provider>
  );
}


/* ═══════════════════════════════════════════════════════════════
   DASHBOARD VIEW — exact Inoreader /dashboard
   Single scrollable column, stacked widget cards.
   Header: "Dashboards" + dropdown + "Add widget" button.
   Widgets: Read later, What's new, Trending, Cases, Alerts, Stats
   ═══════════════════════════════════════════════════════════════ */

interface WidgetConfigField {
  key: string;
  label: string;
  type: 'select' | 'number';
  options?: { value: string; label: string }[];
  default: string | number;
  min?: number;
  max?: number;
}

interface DashWidgetDef {
  id: string;
  title: string;
  icon: typeof Activity;
  configFields?: WidgetConfigField[];
}

const ARTICLE_CONFIG: WidgetConfigField[] = [
  { key: 'source', label: 'Source', type: 'select', options: [{ value: 'all', label: 'Toutes les sources' }], default: 'all' },
  { key: 'view', label: 'Vue', type: 'select', options: [{ value: 'list', label: 'Liste' }, { value: 'magazine', label: 'Magazine' }, { value: 'compact', label: 'Compact' }], default: 'list' },
  { key: 'count', label: "Nombre d'articles", type: 'number', default: 8, min: 3, max: 20 },
  { key: 'sort', label: 'Tri', type: 'select', options: [{ value: 'recent', label: 'Plus récent' }, { value: 'popular', label: 'Populaire' }], default: 'recent' },
];

// Widget TYPES available in the wizard — each instance gets a unique ID
const WIDGET_TYPES: DashWidgetDef[] = [
  { id: 'articles',      title: 'Articles',                 icon: Newspaper, configFields: ARTICLE_CONFIG },
  { id: 'read-later',    title: 'Lire plus tard',           icon: BookmarkPlus, configFields: ARTICLE_CONFIG },
  { id: 'trending',      title: 'Tendances',                icon: TrendingUp, configFields: ARTICLE_CONFIG },
  { id: 'cases',         title: 'Cases suivis',             icon: FolderOpen },
  { id: 'alerts',        title: 'Alertes menaces',          icon: AlertTriangle, configFields: ARTICLE_CONFIG },
  { id: 'stats',         title: 'Statistiques',             icon: BarChart2,
    configFields: [{ key: 'type', label: 'Type', type: 'select', options: [{ value: 'overview', label: "Vue d'ensemble" }, { value: 'sources', label: 'Par source' }, { value: 'threats', label: 'Par menace' }], default: 'overview' }] },
];

// For backward compat — map old IDs to widget types
function getWidgetType(instanceId: string): DashWidgetDef | undefined {
  const typeId = instanceId.replace(/-\d+$/, ''); // "articles-2" → "articles"
  return WIDGET_TYPES.find(w => w.id === typeId) || WIDGET_TYPES.find(w => w.id === instanceId);
}

// Legacy support
const ALL_DASH_WIDGETS = WIDGET_TYPES;

// Which column each widget defaults to (left=0, right=1)
const WIDGET_COLUMN: Record<string, number> = {
  'read-later': 0, 'whats-new': 0, 'trending': 0,
  'cases': 1, 'alerts': 1, 'stats': 1,
};

const DASH_STORAGE_KEY = 'wm-dash-widgets-v2';

function loadDashWidgets(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DASH_STORAGE_KEY) || 'null');
    if (Array.isArray(stored)) return stored;
  } catch { /* ignore */ }
  return ['read-later', 'whats-new', 'trending', 'cases'];
}

function saveDashWidgets(ids: string[]) {
  localStorage.setItem(DASH_STORAGE_KEY, JSON.stringify(ids));
}

function DashboardView({ articles, stats, cases, loading, onRefresh, onOpenArticle }: {
  articles: Article[];
  stats: Stats | null;
  cases: CaseData[];
  loading: boolean;
  onRefresh: () => void;
  onOpenArticle: (id: string) => void;
}) {
  const [widgetIds, setWidgetIds] = useState(loadDashWidgets);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [widgetConfigs, setWidgetConfigs] = useState<Record<string, Record<string, any>>>(() => {
    try { return JSON.parse(localStorage.getItem('wm-dash-widget-configs') || '{}'); } catch { return {}; }
  });

  const updateWidgetConfig = (widgetId: string, key: string, value: any) => {
    setWidgetConfigs(prev => {
      const next = { ...prev, [widgetId]: { ...prev[widgetId], [key]: value } };
      localStorage.setItem('wm-dash-widget-configs', JSON.stringify(next));
      return next;
    });
  };

  const getConfig = (widgetId: string, key: string, fallback: any) => {
    return widgetConfigs[widgetId]?.[key] ?? fallback;
  };

  // Fetch read-later & trending from API
  const [readLaterArticles, setReadLaterArticles] = useState<ArticleSummary[]>([]);
  const [trendingArticles, setTrendingArticles] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    listReadLater(10).then(d => setReadLaterArticles(d.articles)).catch(() => {});
    getTrending('day', 10).then(d => setTrendingArticles(d.articles)).catch(() => {});
  }, []);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const removeWidget = (id: string) => {
    const next = widgetIds.filter(w => w !== id);
    setWidgetIds(next);
    saveDashWidgets(next);
  };

  const addWidget = (id: string) => {
    if (widgetIds.includes(id)) return;
    const next = [...widgetIds, id];
    setWidgetIds(next);
    saveDashWidgets(next);
    setShowAddMenu(false);
  };

  const alertArticles = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high');
  const availableToAdd = ALL_DASH_WIDGETS.filter(w => !widgetIds.includes(w.id));

  function formatSource(s: string) {
    return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
  }

  /* Article row — exact Inoreader style: large thumbnail left, title + source + time right */
  function ArticleRow({ a }: { a: Article | ArticleSummary }) {
    const imgUrl = (a as any).image_url;
    return (
      <button
        onClick={() => onOpenArticle(a.id)}
        className="group flex items-start gap-4 w-full text-left px-5 py-3.5 transition-all duration-150"
        style={{ borderBottom: `1px solid ${BORDER}` }}
        onMouseOver={e => { e.currentTarget.style.background = '#1a2d3f'; }}
        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Thumbnail — 100x70px like Inoreader */}
        <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 100, height: 70, background: '#0f1923' }}>
          {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-[15px] font-bold line-clamp-2 leading-snug" style={{ color: TEXT_HEADING }}>{a.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[12px] font-medium" style={{ color: ACCENT }}>
              {formatSource((a as any).source_id || '')}
            </span>
            <ExternalLink size={10} style={{ color: ACCENT, opacity: 0.7 }} />
            {(a as any).pub_date && (
              <>
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>·</span>
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>
                  {timeAgo((a as any).pub_date)}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 shrink-0 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="p-1.5 rounded-md hover:bg-white/5 cursor-pointer" style={{ color: '#4a5a6a' }}><BookmarkPlus size={14} /></span>
          <span className="p-1.5 rounded-md hover:bg-white/5 cursor-pointer" style={{ color: '#4a5a6a' }}><Eye size={14} /></span>
          <span className="p-1.5 rounded-md hover:bg-white/5 cursor-pointer" style={{ color: '#4a5a6a' }}><MoreHorizontal size={14} /></span>
        </div>
      </button>
    );
  }

  /* Trending featured article — big image card like Inoreader */
  function TrendingFeatured({ a }: { a: Article | ArticleSummary }) {
    const imgUrl = (a as any).image_url;
    return (
      <button
        onClick={() => onOpenArticle(a.id)}
        className="w-full rounded-xl overflow-hidden cursor-pointer transition-all text-left"
        style={{ background: '#0f1923' }}
        onMouseOver={e => { e.currentTarget.style.opacity = '0.9'; }}
        onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}
      >
        <div className="relative h-48 overflow-hidden">
          {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-[16px] font-bold leading-snug line-clamp-2 text-white mb-1">{a.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: '#7cb3f5' }}>{formatSource((a as any).source_id || '')}</span>
              <ExternalLink size={10} style={{ color: '#7cb3f5' }} />
            </div>
          </div>
        </div>
      </button>
    );
  }

  function renderWidgetContent(id: string) {
    const count = getConfig(id, 'count', 8) as number;

    switch (id) {
      case 'read-later':
        return readLaterArticles.length === 0
          ? <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucun article sauvegardé</div>
          : readLaterArticles.slice(0, count).map(a => <ArticleRow key={a.id} a={a} />);

      case 'whats-new':
        return articles.length === 0
          ? <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucun article</div>
          : articles.slice(0, count).map(a => <ArticleRow key={a.id} a={a} />);

      case 'trending':
        if (trendingArticles.length === 0 && articles.length === 0) {
          return <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucune tendance</div>;
        }
        const tItems = trendingArticles.length > 0 ? trendingArticles : [...articles].sort((a, b) => {
          const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
          return (o[a.threat_level] ?? 5) - (o[b.threat_level] ?? 5);
        }).slice(0, count);
        return (
          <div>
            {tItems[0] && <div className="p-3"><TrendingFeatured a={tItems[0]} /></div>}
            {tItems.slice(1).map(a => <ArticleRow key={a.id} a={a} />)}
          </div>
        );

      case 'cases':
        return cases.length === 0
          ? <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucun case — créez-en dans l'onglet Cases</div>
          : (
            <div className="p-3 space-y-1">
              {cases.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                  onMouseOver={e => { e.currentTarget.style.background = '#1e2f40'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: BG_APP, color: TEXT_SECONDARY }}>
                    {c.type === 'company' ? <Building size={14} /> : c.type === 'country' ? <Globe size={14} /> : <Activity size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: TEXT_HEADING }}>{c.name}</div>
                    <div className="text-[11px]" style={{ color: TEXT_SECONDARY }}>{c.article_count} articles · {c.type}</div>
                  </div>
                  {c.alert_count > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#ef4444', background: '#2d1515' }}>{c.alert_count}</span>
                  )}
                </div>
              ))}
            </div>
          );

      case 'alerts':
        return alertArticles.length === 0
          ? <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucune alerte</div>
          : alertArticles.slice(0, 8).map(a => <ArticleRow key={a.id} a={a} />);

      case 'stats':
        return (
          <div className="p-4 space-y-3">
            {[
              { l: "Articles aujourd'hui", v: articles.filter(a => a.pub_date && (Date.now() - new Date(a.pub_date).getTime()) < 86400000).length },
              { l: 'Sources actives', v: new Set(articles.map(a => a.source_id)).size },
              { l: 'Pays couverts', v: new Set(articles.flatMap(a => a.country_codes)).size },
              { l: 'Thèmes', v: new Set(articles.map(a => a.theme).filter(Boolean)).size },
              { l: 'Alertes (24h)', v: alertArticles.filter(a => a.pub_date && (Date.now() - new Date(a.pub_date).getTime()) < 86400000).length },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <span className="text-[13px]" style={{ color: TEXT_SECONDARY }}>{s.l}</span>
                <span className="text-[15px] font-bold" style={{ color: ACCENT }}>{s.v}</span>
              </div>
            ))}
          </div>
        );

      default:
        return <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Widget inconnu</div>;
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: BG_APP }}>
      {/* Header — Inoreader exact: "Dashboards" title + dropdown + Add widget */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3">
          <h1 className="text-[24px] font-bold" style={{ color: TEXT_HEADING }}>Dashboards</h1>
          <ChevronDown size={16} style={{ color: TEXT_SECONDARY }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-2 rounded-lg transition-colors" style={{ color: TEXT_SECONDARY }} title="Actualiser">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Dashboard subtitle */}
      <div className="flex items-center gap-2 px-6 py-2">
        <span className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>DEFAULT DASHBOARD</span>
      </div>

      {/* Widgets — 2 column grid like Inoreader (60/40 split) */}
      <div className="px-6 pb-8" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(300px, 380px)', gap: '16px', alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div className="space-y-4">
          {widgetIds.filter(id => (WIDGET_COLUMN[id] ?? 0) === 0).map(widgetId => (
            <WidgetCard key={widgetId} widgetId={widgetId} collapsed={collapsed} toggleCollapse={toggleCollapse} removeWidget={removeWidget} renderContent={renderWidgetContent} widgetConfigs={widgetConfigs} updateWidgetConfig={updateWidgetConfig} />
          ))}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          {widgetIds.filter(id => (WIDGET_COLUMN[id] ?? 0) === 1).map(widgetId => (
            <WidgetCard key={widgetId} widgetId={widgetId} collapsed={collapsed} toggleCollapse={toggleCollapse} removeWidget={removeWidget} renderContent={renderWidgetContent} widgetConfigs={widgetConfigs} updateWidgetConfig={updateWidgetConfig} />
          ))}

          {/* Add widget button — bottom right like Inoreader */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-colors"
              style={{ color: ACCENT, border: `1px dashed ${BORDER}`, background: showAddMenu ? `${ACCENT}10` : 'transparent' }}
            >
              <Plus size={16} />
              Add widget
            </button>

            {showAddMenu && availableToAdd.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
                {availableToAdd.map(w => (
                  <button
                    key={w.id}
                    onClick={() => addWidget(w.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    onMouseOver={e => { e.currentTarget.style.background = '#1e2f40'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <w.icon size={16} style={{ color: ACCENT }} />
                    <span className="text-[13px] font-medium" style={{ color: TEXT_HEADING }}>{w.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Widget Card component with config panel ── */
function WidgetCard({ widgetId, collapsed, toggleCollapse, removeWidget, renderContent, widgetConfigs, updateWidgetConfig }: {
  widgetId: string;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  removeWidget: (id: string) => void;
  renderContent: (id: string) => React.ReactNode;
  widgetConfigs: Record<string, Record<string, any>>;
  updateWidgetConfig: (widgetId: string, key: string, value: any) => void;
}) {
  const [showConfig, setShowConfig] = useState(false);
  const def = ALL_DASH_WIDGETS.find(w => w.id === widgetId);
  if (!def) return null;
  const isCollapsed = collapsed.has(widgetId);
  const Icon = def.icon;
  const configs = widgetConfigs[widgetId] || {};

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ borderBottom: isCollapsed && !showConfig ? 'none' : `1px solid ${BORDER}` }}
        onClick={() => toggleCollapse(widgetId)}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={16} style={{ color: ACCENT }} />
          <span className="text-[14px] font-semibold" style={{ color: TEXT_HEADING }}>{def.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {def.configFields && (
            <button
              onClick={e => { e.stopPropagation(); setShowConfig(!showConfig); }}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: showConfig ? ACCENT : TEXT_SECONDARY, background: showConfig ? `${ACCENT}15` : 'transparent' }}
              title="Configurer"
            >
              <Settings size={13} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); removeWidget(widgetId); }}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: TEXT_SECONDARY }}
            title="Retirer"
          >
            <MoreHorizontal size={13} />
          </button>
          {isCollapsed
            ? <ChevronDown size={14} style={{ color: TEXT_SECONDARY }} />
            : <ChevronUp size={14} style={{ color: TEXT_SECONDARY }} />
          }
        </div>
      </div>

      {/* Config panel — Inoreader style dropdown */}
      {showConfig && def.configFields && (
        <div className="px-4 py-3 space-y-3" style={{ background: '#0f1923', borderBottom: `1px solid ${BORDER}` }}>
          {def.configFields.map(field => (
            <div key={field.key} className="flex items-center justify-between gap-3">
              <label className="text-[12px] font-medium" style={{ color: TEXT_PRIMARY }}>{field.label}</label>
              {field.type === 'select' && field.options && (
                <select
                  value={configs[field.key] ?? field.default}
                  onChange={e => updateWidgetConfig(widgetId, field.key, e.target.value)}
                  className="px-2 py-1 rounded-lg text-[12px] outline-none"
                  style={{ background: BG_CARD, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
                >
                  {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {field.type === 'number' && (
                <input
                  type="number"
                  value={configs[field.key] ?? field.default}
                  min={field.min}
                  max={field.max}
                  onChange={e => updateWidgetConfig(widgetId, field.key, parseInt(e.target.value) || field.default)}
                  className="w-16 px-2 py-1 rounded-lg text-[12px] text-right outline-none"
                  style={{ background: BG_CARD, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {!isCollapsed && <div>{renderContent(widgetId)}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS VIEW
   ═══════════════════════════════════════════════════════════════ */
type SettingsTab = 'sources' | 'intel-models' | 'apis' | 'display' | 'account';

function DisplaySettings() {
  const [config, setConfig] = useState(() => getDisplaySettingsFn());

  function save(key: string, value: number) {
    const updated = setDisplaySettingsFn({ [key]: value });
    setConfig(updated);
  }

  const fields: { key: string; label: string; desc: string; min: number; max: number }[] = [
    { key: 'feedArticleLimit', label: 'Articles par Feed', desc: 'Nombre max d\'articles affichés dans un AI Feed', min: 10, max: 500 },
    { key: 'caseArticleLimit', label: 'Articles par Case', desc: 'Nombre max d\'articles affichés dans un Case', min: 10, max: 1000 },
    { key: 'widgetArticleLimit', label: 'Articles par Widget', desc: 'Nombre max d\'articles dans les widgets du dashboard', min: 5, max: 200 },
    { key: 'dashboardArticleLimit', label: 'Articles Dashboard', desc: 'Nombre max d\'articles dans la vue principale', min: 20, max: 2000 },
    { key: 'previewArticleLimit', label: 'Articles Preview', desc: 'Nombre d\'articles dans les previews de feeds', min: 5, max: 200 },
  ];

  return (
    <div className="max-w-lg space-y-4">
      <div className="rounded-xl p-5" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
        <h3 className="font-bold text-sm mb-4" style={{ color: TEXT_HEADING }}>Limites d'affichage</h3>
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: TEXT_PRIMARY }}>{f.label}</div>
                <div className="text-[10px]" style={{ color: TEXT_SECONDARY }}>{f.desc}</div>
              </div>
              <input
                type="number"
                value={(config as any)[f.key]}
                min={f.min}
                max={f.max}
                onChange={e => save(f.key, Math.max(f.min, Math.min(f.max, parseInt(e.target.value) || f.min)))}
                className="w-20 px-2 py-1 text-sm text-right rounded-lg outline-none"
                style={{ background: BG_SIDEBAR, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-4" style={{ color: TEXT_SECONDARY }}>Les changements sont appliqués immédiatement.</p>
      </div>
    </div>
  );
}

function SettingsView({ user, stats, cases, onLogout }: {
  user: { email: string; org_name: string };
  stats: Stats | null;
  cases: any[];
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>('sources');
  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'sources', label: 'Sources RSS' },
    { key: 'intel-models', label: 'Intel Models' },
    { key: 'apis', label: 'APIs & Services' },
    { key: 'display', label: 'Affichage' },
    { key: 'account', label: 'Compte' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: BG_CARD }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-1.5 text-xs font-medium rounded-md transition-colors"
            style={{ background: tab === t.key ? ACCENT : 'transparent', color: tab === t.key ? '#fff' : TEXT_SECONDARY }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'sources' && <SourceManager />}
      {tab === 'intel-models' && <IntelModelsManager />}
      {tab === 'apis' && <ApiServices />}
      {tab === 'display' && <DisplaySettings />}
      {tab === 'account' && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-xl p-5" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: TEXT_HEADING }}>Compte</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span style={{ color: TEXT_SECONDARY }}>Email</span><span className="font-medium" style={{ color: TEXT_PRIMARY }}>{user.email}</span></div>
              <div className="flex justify-between"><span style={{ color: TEXT_SECONDARY }}>Organisation</span><span className="font-medium" style={{ color: TEXT_PRIMARY }}>{user.org_name}</span></div>
            </div>
          </div>
          <div className="rounded-xl p-5" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
            <h3 className="font-bold text-sm mb-3" style={{ color: TEXT_HEADING }}>Backend API</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span style={{ color: TEXT_SECONDARY }}>URL</span><span className="font-mono text-xs" style={{ color: TEXT_PRIMARY }}>localhost:8000/api</span></div>
              <div className="flex justify-between"><span style={{ color: TEXT_SECONDARY }}>Documents</span><span className="font-medium" style={{ color: ACCENT }}>{stats?.total || 0}</span></div>
              <div className="flex justify-between"><span style={{ color: TEXT_SECONDARY }}>Sources</span><span className="font-medium" style={{ color: ACCENT }}>{Object.keys(stats?.by_source || {}).length}</span></div>
              <div className="flex justify-between"><span style={{ color: TEXT_SECONDARY }}>Cases</span><span className="font-medium" style={{ color: ACCENT }}>{cases.length}</span></div>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-colors" style={{ color: '#ef4444', border: '1px solid #3b1515' }}>
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
