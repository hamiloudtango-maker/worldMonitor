import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  LayoutDashboard, FolderOpen, FileBarChart, Settings, Bell, Search,
  AlertTriangle, Globe, TrendingUp, Building,
  Newspaper, Activity, BarChart2,
  RefreshCw, LogOut, ExternalLink, Rss, Clock
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import type { CaseData } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';
import { capitalize, timeAgo } from '@/v2/lib/constants';
import { useCases } from '@/v2/hooks/useCases';
import { DataProvider, useGlobalData } from '@/v2/hooks/useData';
import { fetchArticlesByModels } from '@/v2/lib/api';
import { getDisplaySettings as getDisplaySettingsFn, setDisplaySettings as setDisplaySettingsFn } from '@/v2/lib/display-settings';
import LiveMap from './LiveMap';
import CasesView from './CasesView';
import WorldView from './WorldView';
import AIFeedsView from './AIFeedsView';
import WidgetGrid, { type WidgetDef as WDef2, type WidgetState as WS2 } from './WidgetGrid';
import { FULL_CATALOG, renderSharedWidget, buildCatalogWithFeeds } from './shared/WidgetCatalog';
import NotificationPanel from './shared/NotificationPanel';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import FilterBar, { type ActiveFilters, EMPTY_FILTERS } from './shared/FilterBar';
import SourceManager from './SourceManager';
import ApiServices from './ApiServices';
import IntelModelsManager from './IntelModelsManager';
import ReportsView from './ReportsView';
import ReaderView from './ReaderView';
import ArticleReader from './ArticleReader';
import { ArticleReaderContext } from '@/v2/hooks/useArticleReader';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface Props {
  user: { email: string; org_name: string };
  onLogout: () => void;
}
type NavKey = 'dashboard' | 'reader' | 'cases' | 'ai-feeds' | 'world' | 'reports' | 'settings';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════ */
// Inoreader dark theme tokens
const BG_APP       = '#131d2a';
const BG_SIDEBAR   = '#0f1923';
const BG_CARD      = '#1a2836';
const ACCENT       = '#4d8cf5';
const TEXT_PRIMARY  = '#b0bec9';
const TEXT_SECONDARY= '#6b7d93';
const BORDER       = '#1e2d3d';
const CHART_COLORS = ['#4d8cf5', '#42d3a5', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];


const NAV_ITEMS: { key: NavKey; label: string; icon: typeof LayoutDashboard; sep?: boolean }[] = [
  { key: 'reader',    label: 'Lecteur',         icon: Newspaper },
  { key: 'dashboard', label: 'Dashboard',       icon: LayoutDashboard },
  { key: 'cases',     label: 'Cases',           icon: FolderOpen },
  { key: 'ai-feeds',  label: 'AI Feeds',        icon: Rss },
  { key: 'world',     label: '360 Mondial',     icon: Globe },
  { key: 'reports',   label: 'Rapports',        icon: FileBarChart },
  { key: 'settings',  label: 'Configuration',   icon: Settings, sep: true },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function getNavFromHash(): NavKey {
  const raw = window.location.hash.replace('#', '').split(':')[0];
  const valid: NavKey[] = ['dashboard', 'reader', 'cases', 'ai-feeds', 'world', 'reports', 'settings'];
  return valid.includes(raw as NavKey) ? (raw as NavKey) : 'reader';
}

export default function Dashboard(props: Props) {
  return (
    <DataProvider>
      <DashboardInner {...props} />
    </DataProvider>
  );
}

function DashboardInner({ user, onLogout }: Props) {
  const [nav, _setNav]              = useState<NavKey>(getNavFromHash);
  const setNav = useCallback((key: NavKey) => {
    window.location.hash = key;
    _setNav(key);
  }, []);

  useEffect(() => {
    const onHash = () => _setNav(getNavFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const { articles, stats, entities, countries, loading, refresh: load } = useGlobalData();
  const [filters, setFilters]       = useState<ActiveFilters>(EMPTY_FILTERS);
  const [catalog, setCatalog]       = useState(FULL_CATALOG);
  const [readingArticleId, setReadingArticleId] = useState<string | null>(null);

  const { cases, loading: casesLoading, add: addCase, remove: removeCase } = useCases();

  // Load feed widgets into catalog
  useEffect(() => {
    buildCatalogWithFeeds().then(setCatalog);
  }, [nav]); // Refresh when switching tabs (in case feeds were created)

  /* ── Filtered articles: backend JOIN when models selected, local filter for text search ── */
  const [modelArticles, setModelArticles] = useState<Article[] | null>(null);

  useEffect(() => {
    if (filters.models.length === 0) { setModelArticles(null); return; }
    fetchArticlesByModels(filters.models).then(r => setModelArticles(r.articles)).catch(() => {});
  }, [filters.models]);

  const baseArticles = filters.models.length > 0 && modelArticles ? modelArticles : articles;
  const filteredArticles = useMemo(() => {
    if (!filters.q) return baseArticles;
    const q = filters.q.toLowerCase();
    return baseArticles.filter(a => a.title.toLowerCase().includes(q));
  }, [baseArticles, filters.q]);

  const alertArticles = useMemo(() =>
    filteredArticles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high')
  , [filteredArticles]);

  const hasFilters = filters.q || filters.models.length;
  const filteredStats = useMemo(() => hasFilters ? (() => {
    const by_theme: Record<string, number> = {};
    const by_threat: Record<string, number> = {};
    const by_source: Record<string, number> = {};
    for (const a of filteredArticles) {
      by_theme[a.theme] = (by_theme[a.theme] || 0) + 1;
      by_threat[a.threat_level] = (by_threat[a.threat_level] || 0) + 1;
      by_source[a.source_id] = (by_source[a.source_id] || 0) + 1;
    }
    return { total: filteredArticles.length, by_theme, by_threat, by_source, by_lang: {} };
  })() : stats, [filteredArticles, hasFilters, stats]);

  const sentimentData = useMemo(() => {
    const neg = (stats?.by_threat['critical'] || 0) + (stats?.by_threat['high'] || 0);
    const pos = stats?.by_threat['low'] || 0;
    const neu = stats?.by_threat['info'] || 0;
    const seed = neg + pos + neu; // deterministic instead of random
    return ['06', '09', '12', '15', '18', '21'].map((h, i) => ({
      time: `${h}:00`,
      positive: Math.round(pos * (0.5 + ((seed * (i + 1) * 7) % 60) / 100)),
      negative: Math.round(neg * (0.3 + ((seed * (i + 1) * 13) % 90) / 100)),
      neutral:  Math.round(neu * (0.5 + ((seed * (i + 1) * 3) % 50) / 100)),
    }));
  }, [stats]);

  const thematicData = useMemo(() => Object.entries(stats?.by_theme || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([n, v]) => ({ name: capitalize(n), value: v }))
  , [stats]);

  const dashRenderContent = useCallback((id: string) => {
    const shared = renderSharedWidget(id, filteredArticles, filteredStats, 'dash');
    if (shared) return shared;
    return <DashContent id={id} stats={stats} articles={articles} cases={cases} alertArticles={alertArticles} sentimentData={sentimentData} thematicData={thematicData} />;
  }, [filteredArticles, filteredStats, stats, articles, cases, alertArticles, sentimentData, thematicData]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <ArticleReaderContext.Provider value={setReadingArticleId}>
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", background: BG_APP, color: TEXT_PRIMARY }}>

      {/* ───────── SIDEBAR (Inoreader-style: dark, icons) ───────── */}
      <aside
        className="flex flex-col shrink-0 z-10 transition-all duration-200"
        style={{ background: BG_SIDEBAR, width: sidebarExpanded ? 220 : 52, borderRight: `1px solid ${BORDER}` }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center justify-center shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366f1)` }}>
            <Globe size={15} className="text-[#b0bec9]" />
          </div>
          {sidebarExpanded && (
            <div className="ml-2.5 leading-tight">
              <div className="font-extrabold text-[12px] text-[#b0bec9] tracking-tight">WorldMonitor</div>
            </div>
          )}
        </div>

        {/* Nav icons with labels (Inoreader-style) */}
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
                  {/* Badge */}
                  {item.key === 'reader' && alertArticles.length > 0 && (
                    <span className="absolute bg-red-500 text-[#b0bec9] text-[8px] font-bold rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, top: 2, right: 2 }}>
                      {Math.min(alertArticles.length, 99)}
                    </span>
                  )}
                  {item.key === 'cases' && cases.length > 0 && (
                    <span className="absolute bg-red-500 text-[#b0bec9] text-[8px] font-bold rounded-full flex items-center justify-center"
                      style={{ width: 16, height: 16, top: 2, right: 2 }}>
                      {cases.length}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Bottom: notifications, settings, user, collapse */}
        <div className="shrink-0 space-y-1 pb-3" style={{ padding: sidebarExpanded ? '0 8px 12px' : '0 6px 12px', borderTop: `1px solid ${BORDER}` }}>
          <div className="pt-3">
            <NotificationBell onOpenArticle={setReadingArticleId} />
          </div>
          {/* User avatar */}
          <div className="flex items-center justify-center py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-[#b0bec9] cursor-pointer" style={{ background: '#e91e8c' }} title={user.email} onClick={onLogout}>
              {user.org_name.charAt(0).toUpperCase()}
            </div>
          </div>
          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            className="w-full flex items-center justify-center py-1.5 rounded transition-colors"
            style={{ color: TEXT_SECONDARY }}
            title={sidebarExpanded ? 'Réduire' : 'Étendre'}
          >
            {sidebarExpanded ? '«' : '»'}
          </button>
        </div>
      </aside>

      {/* ───────── MAIN ───────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Content — no top header bar (Inoreader puts title inside each view) */}
        <div className="flex-1 overflow-hidden">
          {nav === 'reader' && <ReaderView />}

          {nav !== 'reader' && (
            <div className="h-full overflow-y-auto" style={{ background: BG_APP }}>
              {/* View header */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-[22px] font-bold text-[#b0bec9]">
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
                {nav === 'dashboard' && (
                  <WidgetGrid catalog={catalog} storageKey="wm-dash-v3" defaultWidgets={DASH_DEFAULTS} renderContent={dashRenderContent} />
                )}
                {nav === 'cases' && <CasesView cases={cases} loading={casesLoading} onAdd={addCase} onRemove={removeCase} />}
                {nav === 'ai-feeds' && <AIFeedsView />}
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

/* ═══ Dashboard Widget Catalog ═══ */
const DASH_WIDGETS: WDef2[] = [
  // Content (Inoreader-style)
  { id: 'kpis',        title: 'Indicateurs Clés',       icon: Activity,      category: 'Contenu',    defaultW: 12, defaultH: 2,  minH: 2, minW: 6 },
  { id: 'news',        title: 'Nouveaux articles',      icon: Newspaper,     category: 'Contenu',    defaultW: 6,  defaultH: 8,  minH: 4, minW: 4 },
  { id: 'alerts',      title: 'Alertes critiques',      icon: AlertTriangle, category: 'Contenu',    defaultW: 6,  defaultH: 8,  minH: 3, minW: 3 },
  { id: 'cases',       title: 'Cases suivis',           icon: FolderOpen,    category: 'Contenu',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'trending',    title: 'Tendances',              icon: TrendingUp,    category: 'Contenu',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  // Analyse
  { id: 'map',         title: 'Cartographie',           icon: Globe,         category: 'Analyse',    defaultW: 8,  defaultH: 8,  minH: 4, minW: 4 },
  { id: 'sentiment',   title: 'Sentiment Global',       icon: TrendingUp,    category: 'Analyse',    defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'themes',      title: 'Thématiques',            icon: BarChart2,     category: 'Analyse',    defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  // Data & usage (Inoreader-style)
  { id: 'stats',       title: 'Statistiques',           icon: BarChart2,     category: 'Données',    defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'rules-log',   title: 'Journal des rules',      icon: Activity,      category: 'Données',    defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
];

const DASH_DEFAULTS: WS2[] = [
  { id: 'alerts', w: 6, h: 8 },
  { id: 'news', w: 6, h: 8 },
  { id: 'trending', w: 6, h: 6 },
  { id: 'cases', w: 6, h: 6 },
  { id: 'stats', w: 6, h: 5 },
  { id: 'themes', w: 6, h: 5 },
];

/* ═══ Dashboard Widget Content ═══ */
function DashContent({ id, stats, articles, cases, alertArticles, sentimentData, thematicData }: {
  id: string; stats: Stats | null; articles: Article[]; cases: CaseData[];
  alertArticles: Article[]; sentimentData: any[]; thematicData: any[];
}) {
  const setReadingArticleId = useContext(ArticleReaderContext);
  switch (id) {
    case 'kpis':
      return (
        <div className="flex gap-2 p-3 h-full items-center">
          {[
            { l: 'Documents', v: stats?.total || 0, color: '#4d8cf5' },
            { l: 'Cases', v: cases.length, color: '#42d3a5' },
            { l: 'Critiques', v: stats?.by_threat['critical'] || 0, color: '#ef4444' },
            { l: 'Élevées', v: stats?.by_threat['high'] || 0, color: '#f97316' },
            { l: 'Sources', v: Object.keys(stats?.by_source || {}).length, color: '#8b5cf6' },
          ].map((k, i) => (
            <div key={i} className="flex-1 rounded-lg py-3 px-3 text-center" style={{ background: '#0f1923' }}>
              <div className="text-xl font-extrabold" style={{ color: k.color }}>{k.v.toLocaleString()}</div>
              <div className="text-[9px] font-medium uppercase tracking-wider" style={{ color: '#556677' }}>{k.l}</div>
            </div>
          ))}
        </div>
      );
    case 'cases':
      return (
        <div className="overflow-y-auto h-full p-2.5 space-y-1">
          {cases.length === 0 && <div className="text-center text-xs py-8" style={{ color: '#6b7d93' }}>Aucun case — créez-en dans l'onglet Cases</div>}
          {cases.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer" style={{ ':hover': { background: '#162230' } }} onMouseOver={e => (e.currentTarget.style.background = '#162230')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#131d2a', color: '#6b7d93' }}>
                {c.type === 'company' ? <Building size={14} /> : c.type === 'country' ? <Globe size={14} /> : <Activity size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate" style={{ color: '#e2e8f0' }}>{c.name}</div>
                <div className="text-[10px]" style={{ color: '#6b7d93' }}>{c.article_count} articles · {c.type}</div>
              </div>
              {c.alert_count > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#ef4444', background: '#2d1515' }}>{c.alert_count} alertes</span>
              )}
            </div>
          ))}
        </div>
      );
    case 'map':
      return <div className="p-1 h-full">{articles.length > 0 ? <LiveMap articles={articles} /> : <div className="w-full h-full rounded-lg flex items-center justify-center text-xs" style={{ background: '#0f1923', color: '#6b7d93' }}>Chargement...</div>}</div>;
    case 'alerts':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-0.5">
          {alertArticles.slice(0, 12).map(a => (
            <button key={a.id} onClick={() => setReadingArticleId(a.id)} className="flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer" onMouseOver={e => (e.currentTarget.style.background = '#162230')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
              {/* Thumbnail placeholder */}
              <div className="w-16 h-12 rounded-lg shrink-0 flex items-center justify-center" style={{
                background: a.threat_level === 'critical' ? 'linear-gradient(135deg, #2d1515, #1a0808)' : 'linear-gradient(135deg, #2d1f0e, #1a1508)',
              }}>
                <span className="text-[8px] font-bold uppercase" style={{
                  color: a.threat_level === 'critical' ? '#ef4444' : '#f97316',
                }}>{a.threat_level}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold line-clamp-2 leading-snug" style={{ color: '#b0bec9' }}>{a.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: '#4d8cf5' }}>{a.source_id?.replace(/^catalog_|^gnews_/g, '').replace(/_/g, ' ')}</span>
                  <span className="text-[10px]" style={{ color: '#445566' }}>{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
                </div>
              </div>
            </button>
          ))}
          {alertArticles.length === 0 && <div className="text-center text-xs py-6" style={{ color: '#556677' }}>Aucune alerte</div>}
        </div>
      );
    case 'news':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-0.5">
          {articles.slice(0, 15).map(a => (
            <button key={a.id} onClick={() => setReadingArticleId(a.id)} className="flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer" onMouseOver={e => (e.currentTarget.style.background = '#162230')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
              {/* Thumbnail placeholder */}
              <div className="w-14 h-10 rounded shrink-0" style={{
                background: `linear-gradient(135deg, #1a2836, #0f1923)`,
              }} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium line-clamp-2 leading-snug" style={{ color: '#b0bec9' }}>{a.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: '#4d8cf5' }}>{a.source_id?.replace(/^catalog_|^gnews_/g, '').replace(/_/g, ' ')}</span>
                  <span className="text-[10px]" style={{ color: '#445566' }}>{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      );
    case 'sentiment':
      return (
        <div className="p-2 h-full">
          <ResponsiveContainer>
            <AreaChart data={sentimentData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dgP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                <linearGradient id="dgN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.3} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e2d3d" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7d93' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7d93' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #1e2d3d', background: '#131d2a', color: '#c8d6e5', fontSize: 12 }} />
              <Area type="monotone" dataKey="positive" stroke="#34d399" fill="url(#dgP)" strokeWidth={2} />
              <Area type="monotone" dataKey="negative" stroke="#f87171" fill="url(#dgN)" strokeWidth={2} />
              <Area type="monotone" dataKey="neutral" stroke="#4a5c6f" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    case 'themes':
      return (
        <div className="p-2 h-full">
          <ResponsiveContainer>
            <BarChart data={thematicData} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e2d3d" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#c8d6e5', fontWeight: 500 }} width={65} />
              <Tooltip cursor={{ fill: '#162230' }} contentStyle={{ borderRadius: 10, border: '1px solid #1e2d3d', background: '#131d2a', color: '#c8d6e5', fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {thematicData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    case 'trending':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-0.5">
          {[...articles].sort((a, b) => {
            const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
            return (order[a.threat_level] ?? 5) - (order[b.threat_level] ?? 5);
          }).slice(0, 12).map(a => (
            <button key={a.id} onClick={() => setReadingArticleId(a.id)} className="flex items-start gap-3 w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer" onMouseOver={e => (e.currentTarget.style.background = '#162230')} onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="w-14 h-10 rounded shrink-0 overflow-hidden" style={{ background: '#0f1923' }}>
                {(a as any).image_url && <img src={(a as any).image_url} alt="" className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium line-clamp-2 leading-snug" style={{ color: '#b0bec9' }}>{a.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: '#4d8cf5' }}>{a.source_id?.replace(/^catalog_|^gnews_/g, '').replace(/_/g, ' ')}</span>
                  <span className="text-[10px]" style={{ color: '#445566' }}>{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      );
    case 'stats':
      return (
        <div className="p-4 h-full space-y-3 overflow-y-auto">
          {[
            { l: 'Articles aujourd\'hui', v: articles.filter(a => a.pub_date && (Date.now() - new Date(a.pub_date).getTime()) < 86400000).length },
            { l: 'Sources actives', v: new Set(articles.map(a => a.source_id)).size },
            { l: 'Pays couverts', v: new Set(articles.flatMap(a => a.country_codes)).size },
            { l: 'Thèmes', v: new Set(articles.map(a => a.theme).filter(Boolean)).size },
            { l: 'Alertes (24h)', v: articles.filter(a => (a.threat_level === 'critical' || a.threat_level === 'high') && a.pub_date && (Date.now() - new Date(a.pub_date).getTime()) < 86400000).length },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #1e2d3d' }}>
              <span className="text-[12px]" style={{ color: '#6b7d93' }}>{s.l}</span>
              <span className="text-[14px] font-bold" style={{ color: '#4d8cf5' }}>{s.v}</span>
            </div>
          ))}
        </div>
      );
    case 'rules-log':
      return (
        <div className="flex items-center justify-center h-full text-center px-4">
          <div>
            <Activity size={24} style={{ color: '#556677' }} className="mx-auto mb-2" />
            <p className="text-[12px]" style={{ color: '#6b7d93' }}>Les règles d'automatisation s'afficheront ici</p>
            <p className="text-[10px] mt-1" style={{ color: '#445566' }}>Créez des rules dans l'onglet Configuration</p>
          </div>
        </div>
      );
    default:
      return <div className="flex items-center justify-center h-full text-sm" style={{ color: '#556677' }}>Widget inconnu</div>;
  }
}


/* ═══ Settings View with Tabs ═══ */
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
      <div className="bg-white rounded-xl border border-slate-200/60 p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-4">Limites d'affichage</h3>
        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key} className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700">{f.label}</div>
                <div className="text-[10px] text-slate-400">{f.desc}</div>
              </div>
              <input
                type="number"
                value={(config as any)[f.key]}
                min={f.min}
                max={f.max}
                onChange={e => save(f.key, Math.max(f.min, Math.min(f.max, parseInt(e.target.value) || f.min)))}
                className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5]"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-4">Les changements sont appliqués immédiatement et sauvegardés dans le navigateur.</p>
      </div>
    </div>
  );
}
function SettingsView({ user, stats, cases, onLogout }: {
  user: { email: string; org_name: string };
  stats: Stats | null;
  cases: CaseData[];
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
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
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
          <div className="bg-white rounded-xl border border-slate-200/60 p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Compte</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="font-medium">{user.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Organisation</span><span className="font-medium">{user.org_name}</span></div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/60 p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Backend API</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">URL</span><span className="font-mono text-xs">localhost:8000/api</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Documents</span><span className="font-medium">{stats?.total || 0}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sources</span><span className="font-medium">{Object.keys(stats?.by_source || {}).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Thématiques</span><span className="font-medium">{Object.keys(stats?.by_theme || {}).length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cases</span><span className="font-medium">{cases.length}</span></div>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
