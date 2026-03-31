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
const ACCENT       = '#4d8cf5';  // Inoreader-style blue
const ACCENT_LIGHT = '#eef4ff';
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

  return (
    <ArticleReaderContext.Provider value={setReadingArticleId}>
    <div className="flex flex-col h-screen bg-white text-slate-800 overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>

      {/* ───────── TOP BAR (Inoreader-style) ───────── */}
      <header className="h-12 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ACCENT}, #6366f1)` }}>
            <Globe size={14} className="text-white" />
          </div>
          <span className="font-extrabold text-[15px] text-slate-900 tracking-tight">WorldMonitor</span>
        </div>

        {/* Tab bar (Inoreader-style horizontal tabs) */}
        <nav className="flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(item => {
            const isActive = nav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setNav(item.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
                style={isActive ? { background: ACCENT } : undefined}
              >
                <item.icon size={14} />
                <span className="hidden md:inline">{item.label}</span>
                {item.key === 'cases' && cases.length > 0 && (
                  <span className={`text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ${isActive ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {cases.length}
                  </span>
                )}
                {item.key === 'reader' && alertArticles.length > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {Math.min(alertArticles.length, 99)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <GlobalSearch />
          <button onClick={load} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition-colors" title="Actualiser">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <NotificationBell onOpenArticle={setReadingArticleId} />
          {/* User avatar */}
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: ACCENT }}>
              {user.org_name.charAt(0).toUpperCase()}
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors" title="Déconnexion">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ───────── CONTENT ───────── */}
      <div className="flex-1 overflow-hidden">

        {/* Reader = full height, no padding (has its own sidebar) */}
        {nav === 'reader' && <ReaderView />}

        {/* Other views with standard padding */}
        {nav !== 'reader' && (
          <div className="h-full overflow-y-auto p-5 space-y-4 bg-slate-50">

            {nav === 'dashboard' && (
              <WidgetGrid
                catalog={catalog}
                storageKey="wm-dash-v3"
                defaultWidgets={DASH_DEFAULTS}
                renderContent={dashRenderContent}
              />
            )}

            {nav === 'cases' && (
              <CasesView
                cases={cases}
                loading={casesLoading}
                onAdd={addCase}
                onRemove={removeCase}
              />
            )}

            {nav === 'ai-feeds' && <AIFeedsView />}
            {nav === 'world' && <WorldView />}
            {nav === 'reports' && <ReportsView />}
            {nav === 'settings' && <SettingsView user={user} stats={stats} cases={cases} onLogout={onLogout} />}
          </div>
        )}
      </div>

      <ArticleReader articleId={readingArticleId} onClose={() => setReadingArticleId(null)} />
    </div>
    </ArticleReaderContext.Provider>
  );
}

/* ═══ Dashboard Widget Catalog ═══ */
const DASH_WIDGETS: WDef2[] = [
  { id: 'kpis',      title: 'Indicateurs Clés',  icon: Activity,      category: 'Général',  defaultW: 12, defaultH: 2,  minH: 2, minW: 6 },
  { id: 'cases',     title: 'Cases suivis',       icon: FolderOpen,    category: 'Général',  defaultW: 12, defaultH: 5,  minH: 3, minW: 4 },
  { id: 'map',       title: 'Cartographie',       icon: Globe,         category: 'Général',  defaultW: 8,  defaultH: 8,  minH: 4, minW: 4 },
  { id: 'alerts',    title: 'Alertes',            icon: AlertTriangle, category: 'Général',  defaultW: 4,  defaultH: 8,  minH: 3, minW: 3 },
  { id: 'news',      title: 'Actualités',         icon: Newspaper,     category: 'Général',  defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
  { id: 'sentiment', title: 'Sentiment',          icon: TrendingUp,    category: 'Analyse',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'themes',    title: 'Thématiques',        icon: BarChart2,     category: 'Analyse',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
];

const DASH_DEFAULTS: WS2[] = [
  { id: 'kpis', w: 12, h: 2 },
  { id: 'cases', w: 12, h: 5 },
  { id: 'map', w: 8, h: 8 },
  { id: 'alerts', w: 4, h: 8 },
  { id: 'sentiment', w: 6, h: 5 },
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
        <div className="flex gap-2 p-2 h-full items-center">
          {[
            { l: 'Documents', v: stats?.total || 0 }, { l: 'Cases', v: cases.length },
            { l: 'Critiques', v: stats?.by_threat['critical'] || 0 },
            { l: 'Élevées', v: stats?.by_threat['high'] || 0 },
            { l: 'Pays', v: Object.keys(stats?.by_source || {}).length },
          ].map((k, i) => (
            <div key={i} className="flex-1 bg-slate-50 rounded-lg py-2 px-3 text-center">
              <div className="text-lg font-extrabold text-slate-900">{k.v.toLocaleString()}</div>
              <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{k.l}</div>
            </div>
          ))}
        </div>
      );
    case 'cases':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          {cases.length === 0 && <div className="text-center text-xs text-slate-400 py-8">Aucun case — créez-en dans l'onglet Cases</div>}
          {cases.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 transition-all">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                {c.type === 'company' ? <Building size={14} /> : c.type === 'country' ? <Globe size={14} /> : <Activity size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-slate-900 truncate">{c.name}</div>
                <div className="text-[10px] text-slate-400">{c.article_count} articles · {c.type}</div>
              </div>
              {c.alert_count > 0 && (
                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{c.alert_count}</span>
              )}
            </div>
          ))}
        </div>
      );
    case 'map':
      return <div className="p-1 h-full">{articles.length > 0 ? <LiveMap articles={articles} /> : <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 text-xs">Chargement...</div>}</div>;
    case 'alerts':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          {alertArticles.slice(0, 10).map(a => (
            <button key={a.id} onClick={() => setReadingArticleId(a.id)} className="block w-full text-left p-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors cursor-pointer">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${a.threat_level === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{a.threat_level}</span>
                <span className="text-[9px] text-slate-400 ml-auto">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
              </div>
              <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
            </button>
          ))}
          {alertArticles.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Aucune alerte</div>}
        </div>
      );
    case 'news':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          {articles.slice(0, 15).map(a => (
            <button key={a.id} onClick={() => setReadingArticleId(a.id)} className="block w-full text-left pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors cursor-pointer">
              <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
              <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.theme}</span>
              <span className="text-[8px] text-slate-400 ml-2">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
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
                <linearGradient id="dgP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.25} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                <linearGradient id="dgN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.25} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="positive" stroke="#34d399" fill="url(#dgP)" strokeWidth={2} />
              <Area type="monotone" dataKey="negative" stroke="#f87171" fill="url(#dgN)" strokeWidth={2} />
              <Area type="monotone" dataKey="neutral" stroke="#cbd5e1" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    case 'themes':
      return (
        <div className="p-2 h-full">
          <ResponsiveContainer>
            <BarChart data={thematicData} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={65} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {thematicData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    default:
      return <div className="flex items-center justify-center h-full text-sm text-slate-400">Widget inconnu</div>;
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
