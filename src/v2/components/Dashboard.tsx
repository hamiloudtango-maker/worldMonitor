import { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import {
  LayoutDashboard, FolderOpen, FileBarChart, Settings,
  Globe, Newspaper, Rss, Zap, Search, RefreshCw, LogOut,
  TrendingUp, Star, BookmarkPlus, AlertTriangle, Activity,
  BarChart2, Building, Plus, ChevronDown, ChevronUp,
  MoreHorizontal,
} from 'lucide-react';
import type { CaseData } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';
import { timeAgo } from '@/v2/lib/constants';
import { useCases } from '@/v2/hooks/useCases';
import { DataProvider, useGlobalData } from '@/v2/hooks/useData';
import { api } from '@/v2/lib/api';
import { listReadLater, getTrending, listFolders, type ArticleSummary } from '@/v2/lib/sources-api';
import { getDisplaySettings as getDisplaySettingsFn, setDisplaySettings as setDisplaySettingsFn } from '@/v2/lib/display-settings';
import CasesView from './CasesView';
import LiveMap from './LiveMap';
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
import AddSourceView from './AddSourceView';
import SavedView from './SavedView';
import { ArticleReaderContext } from '@/v2/hooks/useArticleReader';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */
interface Props {
  user: { email: string; org_name: string };
  onLogout: () => void;
}
type NavKey = 'dashboard' | 'ai-feeds' | 'saved' | 'cases' | 'automate' | 'search-page' | 'add-source' | 'reports' | 'settings';

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
  { key: 'ai-feeds',  label: 'AI Feeds',        icon: Rss },
  { key: 'saved',     label: 'Enregistré',      icon: BookmarkPlus },
  { key: 'cases',     label: 'Cases',           icon: FolderOpen },
  { key: 'automate',  label: 'Automate',        icon: Zap },
  { key: 'search-page', label: 'Recherche',     icon: Search },
  { key: 'reports',   label: 'Rapports',        icon: FileBarChart },
  { key: 'settings',  label: 'Config',          icon: Settings, sep: true },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function getNavFromHash(): NavKey {
  const raw = window.location.hash.replace('#', '').split(':')[0];
  const valid: NavKey[] = ['dashboard', 'ai-feeds', 'saved', 'cases', 'automate', 'search-page', 'add-source', 'reports', 'settings'];
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
                  {item.key === 'ai-feeds' && alertCount > 0 && (
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
          {/* Add Source nav item */}
          <div className="mt-2 mx-1">
            <button onClick={() => setNav('add-source')}
              className="w-full flex flex-col items-center rounded-lg transition-all"
              style={{ padding: '8px 4px 5px', background: nav === 'add-source' ? `${ACCENT}18` : 'transparent', color: nav === 'add-source' ? ACCENT : ACCENT }}
              onMouseOver={e => { e.currentTarget.style.background = `${ACCENT}15`; }}
              onMouseOut={e => { e.currentTarget.style.background = nav === 'add-source' ? `${ACCENT}18` : 'transparent'; }}
            >
              <Plus size={20} />
              <span className="text-[9px] font-medium mt-1">Ajouter</span>
            </button>
          </div>
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

          {nav === 'add-source' && <AddSourceView />}
          {nav === 'saved' && <SavedView />}

          {nav !== 'dashboard' && nav !== 'add-source' && nav !== 'saved' && (
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
   DASHBOARD VIEW — Inoreader /dashboard
   2-column layout, widget catalog modal, per-widget config modal
   with live preview, multi-instance support.
   ═══════════════════════════════════════════════════════════════ */

import {
  X, Clock, Tag, Flame, ListFilter, CheckSquare, Lightbulb,
  Info, Hash, Map,
} from 'lucide-react';

interface WidgetConfigField {
  key: string;
  label: string;
  type: 'select' | 'number' | 'toggle' | 'text';
  options?: { value: string; label: string }[];
  default: string | number | boolean;
  min?: number;
  max?: number;
}

interface DashWidgetDef {
  id: string;
  title: string;
  description: string;
  icon: typeof Activity;
  category: 'start' | 'content' | 'data';
  configFields?: WidgetConfigField[];
  defaultColumn?: 0 | 1;         // 0=left, 1=right
}

/* ── Shared config templates — exact Inoreader fields ── */
const ARTICLE_CONFIG: WidgetConfigField[] = [
  { key: 'source', label: 'Source', type: 'select', options: [{ value: 'all', label: 'Fil d\'actualité' }], default: 'all' },
  { key: 'view', label: 'Affichage', type: 'select', options: [{ value: 'list', label: 'Liste' }, { value: 'cards', label: 'Vue en Cartes' }, { value: 'magazine', label: 'Vue Magazine' }], default: 'list' },
  { key: 'hideSource', label: 'Masquer le nom de la source', type: 'toggle', default: false },
  { key: 'count', label: "Nombre d'articles à afficher", type: 'select', options: [{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '20', label: '20' }, { value: '30', label: '30' }], default: '10' },
  { key: 'refresh', label: 'Actualisation automatique', type: 'select', options: [{ value: '5', label: '5 minutes' }, { value: '10', label: '10 minutes' }, { value: '30', label: '30 minutes' }, { value: '60', label: '1 heure' }], default: '10' },
  { key: 'unreadOnly', label: 'Afficher uniquement les articles non lus', type: 'toggle', default: false },
];

/* ── Base config that all widgets share ── */
const BASE_CONFIG: WidgetConfigField[] = [
  { key: 'title', label: 'Titre personnalisé', type: 'text', default: '' },
  { key: 'column', label: 'Colonne', type: 'select', options: [{ value: '0', label: 'Gauche' }, { value: '1', label: 'Droite' }], default: '0' },
];

const STATS_CONFIG: WidgetConfigField[] = [
  ...BASE_CONFIG,
  { key: 'type', label: 'Type', type: 'select', options: [{ value: 'overview', label: "Vue d'ensemble" }, { value: 'sources', label: 'Par source' }, { value: 'threats', label: 'Par menace' }], default: 'overview' },
];

/* ── Widget type catalog — Inoreader categories ── */
const WIDGET_TYPES: DashWidgetDef[] = [
  // ── Commencer ──
  { id: 'checklist',     title: 'Profile checklist',         description: 'Personnalisez votre expérience en complétant quelques étapes essentielles.', icon: CheckSquare,  category: 'start', configFields: BASE_CONFIG, defaultColumn: 0 },
  { id: 'tips',          title: 'Tips & Tricks',             description: 'Astuces pour améliorer votre productivité et efficacité.', icon: Lightbulb,    category: 'start', configFields: BASE_CONFIG, defaultColumn: 0 },
  // ── Contenu ──
  { id: 'whats-new',     title: 'Quoi de neuf',              description: 'Rattrapez les articles les plus pertinents de vos feeds.', icon: Star,          category: 'content', configFields: [...BASE_CONFIG, ...ARTICLE_CONFIG], defaultColumn: 0 },
  { id: 'articles',      title: 'Nouveaux articles',         description: 'Accédez au contenu le plus récent de vos feeds et dossiers.', icon: Newspaper,     category: 'content', configFields: [...BASE_CONFIG, ...ARTICLE_CONFIG], defaultColumn: 1 },
  { id: 'read-later',    title: 'Lire plus tard',            description: 'Gardez un œil sur les articles sauvés pour plus tard.', icon: BookmarkPlus,  category: 'content', configFields: [...BASE_CONFIG, ...ARTICLE_CONFIG], defaultColumn: 0 },
  { id: 'tagged',        title: 'Récemment taggés',          description: 'Articles étiquetés par vos thématiques d\'intérêt.', icon: Tag,           category: 'content', configFields: [...BASE_CONFIG, ...ARTICLE_CONFIG], defaultColumn: 1 },
  { id: 'trending',      title: 'Tendances',                 description: 'Articles qui gagnent en popularité en temps réel.', icon: TrendingUp,    category: 'content', configFields: [...BASE_CONFIG, ...ARTICLE_CONFIG], defaultColumn: 0 },
  { id: 'recent-read',   title: 'Articles lus récemment',       description: 'Liste des articles récemment consultés.', icon: Clock,         category: 'content', configFields: BASE_CONFIG, defaultColumn: 1 },
  { id: 'map',           title: 'Carte Mondiale',            description: 'Carte interactive avec les articles géolocalisés et couches de données live.', icon: Map,           category: 'content', configFields: BASE_CONFIG, defaultColumn: 0 },
  // ── Données & usage ──
  { id: 'stats',         title: 'Statistiques',              description: 'Statistiques personnelles sur votre activité de lecture et vos feeds.', icon: BarChart2,     category: 'data', configFields: STATS_CONFIG, defaultColumn: 1 },
  { id: 'cases',         title: 'Cases suivis',              description: 'Vos cases d\'investigation en cours.', icon: FolderOpen,    category: 'data', configFields: BASE_CONFIG, defaultColumn: 1 },
  { id: 'alerts',        title: 'Alertes menaces',           description: 'Articles classés critiques ou haute menace.', icon: AlertTriangle, category: 'data', configFields: [...BASE_CONFIG, ...ARTICLE_CONFIG], defaultColumn: 1 },
  { id: 'rules-log',     title: 'Journal des règles',          description: 'Dernières correspondances de vos règles d\'automatisation.', icon: ListFilter,    category: 'data', configFields: BASE_CONFIG, defaultColumn: 1 },
  { id: 'inactive',      title: 'Feeds inactifs',            description: 'Feeds n\'ayant pas publié depuis un certain temps.', icon: Rss,           category: 'data', configFields: BASE_CONFIG, defaultColumn: 1 },
  { id: 'failing',       title: 'Feeds en erreur',           description: 'Feeds retournant des erreurs lors du fetching.', icon: AlertTriangle, category: 'data', configFields: BASE_CONFIG, defaultColumn: 1 },
];

const CATEGORY_LABELS: Record<string, string> = {
  start: 'Commencer',
  content: 'Contenu',
  data: 'Données & usage',
};

function getWidgetDef(instanceId: string): DashWidgetDef | undefined {
  const typeId = instanceId.replace(/-\d+$/, '');
  return WIDGET_TYPES.find(w => w.id === typeId) || WIDGET_TYPES.find(w => w.id === instanceId);
}

/* ── Persisted widget instances ── */
interface WidgetInstance {
  instanceId: string;  // e.g. "articles-1", "trending", "articles-2"
  typeId: string;      // e.g. "articles", "trending"
  column: 0 | 1;
  config: Record<string, any>;
}

interface DashboardTab {
  id: string;
  name: string;
  widgets: WidgetInstance[];
}

const DASH_STORAGE_KEY = 'wm-dashboards-v4';
const DASH_ACTIVE_KEY  = 'wm-dashboard-active';

const DEFAULT_WIDGETS: WidgetInstance[] = [
  { instanceId: 'read-later',  typeId: 'read-later',  column: 0, config: {} },
  { instanceId: 'whats-new',   typeId: 'whats-new',   column: 0, config: {} },
  { instanceId: 'trending',    typeId: 'trending',     column: 0, config: {} },
  { instanceId: 'articles-1',  typeId: 'articles',     column: 1, config: { view: 'list', count: '10' } },
];

function loadDashboards(): DashboardTab[] {
  try {
    const stored = JSON.parse(localStorage.getItem(DASH_STORAGE_KEY) || 'null');
    if (Array.isArray(stored) && stored.length > 0 && stored[0].id) return stored;
  } catch { /* ignore */ }
  return [{ id: 'default', name: 'Default dashboard', widgets: DEFAULT_WIDGETS }];
}

function saveDashboards(tabs: DashboardTab[]) {
  localStorage.setItem(DASH_STORAGE_KEY, JSON.stringify(tabs));
}

function loadActiveTab(): string {
  return localStorage.getItem(DASH_ACTIVE_KEY) || 'default';
}

function saveActiveTab(id: string) {
  localStorage.setItem(DASH_ACTIVE_KEY, id);
}

let _nextId = Date.now();
function genInstanceId(typeId: string): string {
  return `${typeId}-${++_nextId}`;
}

function genTabId(): string {
  return `dash-${++_nextId}`;
}

/* ═══════════════════════════════════════════════════════════════
   DashboardView COMPONENT
   ═══════════════════════════════════════════════════════════════ */
function DashboardView({ articles, stats, cases, loading, onRefresh, onOpenArticle }: {
  articles: Article[];
  stats: Stats | null;
  cases: CaseData[];
  loading: boolean;
  onRefresh: () => void;
  onOpenArticle: (id: string) => void;
}) {
  const [dashboards, setDashboards] = useState<DashboardTab[]>(loadDashboards);
  const [activeTabId, setActiveTabId] = useState<string>(loadActiveTab);
  const [renamingTab, setRenamingTab] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [tabMenuOpen, setTabMenuOpen] = useState<string | null>(null);

  const activeTab = dashboards.find(d => d.id === activeTabId) || dashboards[0];
  const widgets = activeTab?.widgets || [];

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogColumn, setCatalogColumn] = useState<0 | 1>(0);
  const [configModal, setConfigModal] = useState<{ def: DashWidgetDef; column: 0 | 1; editInstance?: WidgetInstance } | null>(null);

  // Fetch read-later & trending from API
  const [readLaterArticles, setReadLaterArticles] = useState<ArticleSummary[]>([]);
  const [trendingArticles, setTrendingArticles] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    listReadLater(20).then(d => setReadLaterArticles(d.articles)).catch(() => {});
    getTrending('day', 20).then(d => setTrendingArticles(d.articles)).catch(() => {});
  }, []);

  const alertArticles = useMemo(() => articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high'), [articles]);

  /* ── Tab management ── */
  const saveTabs = (next: DashboardTab[]) => { setDashboards(next); saveDashboards(next); };

  const switchTab = (id: string) => { setActiveTabId(id); saveActiveTab(id); setTabMenuOpen(null); };

  const addTab = () => {
    const id = genTabId();
    const newTab: DashboardTab = { id, name: 'Nouveau dashboard', widgets: [] };
    const next = [...dashboards, newTab];
    saveTabs(next);
    switchTab(id);
    setRenamingTab(id);
    setRenameValue('Nouveau dashboard');
  };

  const renameTab = (id: string) => {
    if (!renameValue.trim()) return;
    saveTabs(dashboards.map(d => d.id === id ? { ...d, name: renameValue.trim() } : d));
    setRenamingTab(null);
  };

  const deleteTab = (id: string) => {
    if (dashboards.length <= 1) return;
    const next = dashboards.filter(d => d.id !== id);
    saveTabs(next);
    if (activeTabId === id) switchTab(next[0].id);
    setTabMenuOpen(null);
  };

  const duplicateTab = (id: string) => {
    const src = dashboards.find(d => d.id === id);
    if (!src) return;
    const newId = genTabId();
    const dup: DashboardTab = { id: newId, name: src.name + ' (copie)', widgets: src.widgets.map(w => ({ ...w, instanceId: genInstanceId(w.typeId) })) };
    saveTabs([...dashboards, dup]);
    switchTab(newId);
    setTabMenuOpen(null);
  };

  /* ── Widget management (scoped to active tab) ── */
  const save = (nextWidgets: WidgetInstance[]) => {
    saveTabs(dashboards.map(d => d.id === activeTabId ? { ...d, widgets: nextWidgets } : d));
  };

  const removeWidget = (instanceId: string) => save(widgets.filter(w => w.instanceId !== instanceId));

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const updateWidgetConfig = (instanceId: string, key: string, value: any) => {
    const next = widgets.map(w => w.instanceId === instanceId ? { ...w, config: { ...w.config, [key]: value } } : w);
    save(next);
  };

  const openCatalog = (column: 0 | 1) => { setCatalogColumn(column); setCatalogOpen(true); };

  const onCatalogSelect = (def: DashWidgetDef) => {
    // If widget has config fields, open config modal; otherwise add directly
    if (def.configFields) {
      setConfigModal({ def, column: catalogColumn });
      setCatalogOpen(false);
    } else {
      const instanceId = genInstanceId(def.id);
      save([...widgets, { instanceId, typeId: def.id, column: catalogColumn, config: {} }]);
      setCatalogOpen(false);
    }
  };

  const onConfigConfirm = (config: Record<string, any>) => {
    if (!configModal) return;
    const { def, column, editInstance } = configModal;
    const chosenColumn = (parseInt(String(config.column)) || column) as 0 | 1;
    if (editInstance) {
      // Editing existing instance — also update column if changed
      save(widgets.map(w => w.instanceId === editInstance.instanceId ? { ...w, column: chosenColumn, config } : w));
    } else {
      // Adding new instance
      const instanceId = genInstanceId(def.id);
      save([...widgets, { instanceId, typeId: def.id, column: chosenColumn, config }]);
    }
    setConfigModal(null);
  };

  const openEditConfig = (instance: WidgetInstance) => {
    const def = getWidgetDef(instance.typeId);
    if (def?.configFields) setConfigModal({ def, column: instance.column, editInstance: instance });
  };

  function formatSource(s: string) {
    return s.replace(/^catalog_|^gnews_|^gdelt_|^plugin_\w+_/g, '').replace(/_/g, ' ');
  }

  /* ── Article row — Inoreader style ── */
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
        <div className="shrink-0 rounded-lg overflow-hidden" style={{ width: 100, height: 70, background: '#0f1923' }}>
          {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <p className="text-[15px] font-bold line-clamp-2 leading-snug" style={{ color: TEXT_HEADING }}>{a.title}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[12px] font-medium" style={{ color: ACCENT }}>{formatSource((a as any).source_id || '')}</span>
            {(a as any).pub_date && (
              <>
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>·</span>
                <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{timeAgo((a as any).pub_date)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="p-1.5 rounded-md hover:bg-white/5 cursor-pointer" style={{ color: '#4a5a6a' }}><BookmarkPlus size={14} /></span>
          <span className="p-1.5 rounded-md hover:bg-white/5 cursor-pointer" style={{ color: '#4a5a6a' }}><MoreHorizontal size={14} /></span>
        </div>
      </button>
    );
  }

  /* ── Trending featured — big image hero card ── */
  function TrendingFeatured({ a }: { a: Article | ArticleSummary }) {
    const imgUrl = (a as any).image_url;
    return (
      <button onClick={() => onOpenArticle(a.id)} className="w-full rounded-xl overflow-hidden cursor-pointer text-left" style={{ background: '#0f1923' }}>
        <div className="relative h-48 overflow-hidden">
          {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-[16px] font-bold leading-snug line-clamp-2 text-white mb-1">{a.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium" style={{ color: '#7cb3f5' }}>{formatSource((a as any).source_id || '')}</span>
              <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>· {timeAgo((a as any).pub_date || '')}</span>
            </div>
          </div>
        </div>
      </button>
    );
  }

  /* ── Article cards view — Inoreader "Vue en Cartes" ── */
  function ArticleCards({ items, count }: { items: (Article | ArticleSummary)[]; count: number }) {
    return (
      <div className="grid grid-cols-2 gap-3 p-3">
        {items.slice(0, count).map(a => {
          const imgUrl = (a as any).image_url;
          return (
            <button key={a.id} onClick={() => onOpenArticle(a.id)} className="rounded-lg overflow-hidden text-left transition-all" style={{ background: '#0f1923' }}
              onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; }} onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}>
              <div className="relative h-28 overflow-hidden">
                {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 60%)' }} />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-[12px] font-semibold leading-tight line-clamp-2 text-white">{a.title}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-2.5 py-2">
                <span className="text-[10px] font-medium truncate" style={{ color: ACCENT }}>{formatSource((a as any).source_id || '')}</span>
                {(a as any).pub_date && <span className="text-[10px] shrink-0" style={{ color: TEXT_SECONDARY }}>{timeAgo((a as any).pub_date)}</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  /* ── Render widget content by type ── */
  function renderWidgetContent(instance: WidgetInstance) {
    const count = parseInt(String(instance.config.count)) || 10;
    const viewMode = (instance.config.view as string) || 'list';

    const renderArticles = (items: (Article | ArticleSummary)[]) => {
      if (items.length === 0) return <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucun article</div>;
      if (viewMode === 'cards') return <ArticleCards items={items} count={count} />;
      return items.slice(0, count).map(a => <ArticleRow key={a.id} a={a} />);
    };

    switch (instance.typeId) {
      case 'read-later':
        return renderArticles(readLaterArticles);

      case 'whats-new':
      case 'articles':
        return renderArticles(articles);

      case 'tagged':
        return renderArticles(articles.filter(a => (a as any).tags?.length > 0));

      case 'trending': {
        const tItems = trendingArticles.length > 0 ? trendingArticles : [...articles].sort((a, b) => {
          const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
          return (o[a.threat_level] ?? 5) - (o[b.threat_level] ?? 5);
        });
        if (tItems.length === 0) return <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucune tendance</div>;
        return (
          <div>
            {tItems[0] && <div className="p-3"><TrendingFeatured a={tItems[0]} /></div>}
            {tItems.slice(1, count).map(a => <ArticleRow key={a.id} a={a} />)}
          </div>
        );
      }

      case 'recent-read':
        return renderArticles(articles.slice(0, 5));

      case 'map':
        return (
          <div style={{ height: 450 }}>
            <LiveMap articles={articles} />
          </div>
        );

      case 'alerts':
        return renderArticles(alertArticles);

      case 'cases':
        return cases.length === 0
          ? <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucun case — créez-en dans l'onglet Cases</div>
          : (
            <div className="p-3 space-y-1">
              {cases.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                  onMouseOver={e => { e.currentTarget.style.background = '#1e2f40'; }} onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: BG_APP, color: TEXT_SECONDARY }}>
                    {c.type === 'company' ? <Building size={14} /> : c.type === 'country' ? <Globe size={14} /> : <Activity size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: TEXT_HEADING }}>{c.name}</div>
                    <div className="text-[11px]" style={{ color: TEXT_SECONDARY }}>{c.article_count} articles · {c.type}</div>
                  </div>
                  {c.alert_count > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#ef4444', background: '#2d1515' }}>{c.alert_count}</span>}
                </div>
              ))}
            </div>
          );

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

      case 'checklist':
        return (
          <div className="p-4 space-y-2">
            {[
              { l: 'Ajouter des sources RSS', done: articles.length > 0 },
              { l: 'Créer un Case d\'investigation', done: cases.length > 0 },
              { l: 'Configurer les alertes', done: alertArticles.length > 0 },
              { l: 'Explorer les tendances', done: trendingArticles.length > 0 },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold" style={{ background: s.done ? '#0f2d1a' : BG_APP, color: s.done ? '#22c55e' : TEXT_SECONDARY, border: `1px solid ${s.done ? '#22c55e30' : BORDER}` }}>
                  {s.done ? '✓' : ''}
                </div>
                <span className="text-[13px]" style={{ color: s.done ? TEXT_SECONDARY : TEXT_PRIMARY, textDecoration: s.done ? 'line-through' : 'none' }}>{s.l}</span>
              </div>
            ))}
          </div>
        );

      case 'tips':
        return (
          <div className="p-4 space-y-3">
            {[
              'Utilisez Cmd+K pour la recherche globale rapide',
              'Créez des Cases pour suivre des sujets spécifiques',
              'Les règles d\'automatisation filtrent les articles automatiquement',
              'Importez vos sources avec un fichier OPML',
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-3 py-1">
                <Lightbulb size={14} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <span className="text-[13px]" style={{ color: TEXT_PRIMARY }}>{t}</span>
              </div>
            ))}
          </div>
        );

      case 'rules-log':
      case 'inactive':
      case 'failing':
        return <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Aucune donnée</div>;

      default:
        return <div className="px-4 py-6 text-center text-[12px]" style={{ color: TEXT_SECONDARY }}>Widget inconnu</div>;
    }
  }

  const leftWidgets = widgets.filter(w => w.column === 0);
  const rightWidgets = widgets.filter(w => w.column === 1);

  return (
    <div className="h-full overflow-y-auto" style={{ background: BG_APP }} onClick={() => { setTabMenuOpen(null); }}>
      {/* Header */}
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

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}` }}>
        {dashboards.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div key={tab.id} className="relative flex items-center shrink-0">
              {renamingTab === tab.id ? (
                <input autoFocus value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => renameTab(tab.id)}
                  onKeyDown={e => { if (e.key === 'Enter') renameTab(tab.id); if (e.key === 'Escape') setRenamingTab(null); }}
                  className="text-[13px] font-medium px-3 py-1.5 rounded-md outline-none"
                  style={{ background: `${ACCENT}18`, color: ACCENT, border: `1px solid ${ACCENT}`, width: Math.max(120, renameValue.length * 8) }}
                />
              ) : (
                <button onClick={() => switchTab(tab.id)}
                  onDoubleClick={() => { setRenamingTab(tab.id); setRenameValue(tab.name); }}
                  className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors"
                  style={{ background: isActive ? `${ACCENT}18` : 'transparent', color: isActive ? ACCENT : TEXT_SECONDARY }}
                  onMouseOver={e => { if (!isActive) e.currentTarget.style.background = `${ACCENT}08`; }}
                  onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {tab.name}
                </button>
              )}
              {/* Tab context menu */}
              {isActive && renamingTab !== tab.id && (
                <button onClick={e => { e.stopPropagation(); setTabMenuOpen(tabMenuOpen === tab.id ? null : tab.id); }}
                  className="p-0.5 rounded ml-0.5" style={{ color: TEXT_SECONDARY }}>
                  <MoreHorizontal size={12} />
                </button>
              )}
              {tabMenuOpen === tab.id && (
                <div className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-30 shadow-lg min-w-[160px]"
                  style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
                  <button onClick={() => { setRenamingTab(tab.id); setRenameValue(tab.name); setTabMenuOpen(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors"
                    style={{ color: TEXT_PRIMARY }}
                    onMouseOver={e => { e.currentTarget.style.background = '#1e2f40'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                    Renommer
                  </button>
                  <button onClick={() => duplicateTab(tab.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors"
                    style={{ color: TEXT_PRIMARY }}
                    onMouseOver={e => { e.currentTarget.style.background = '#1e2f40'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                    Dupliquer
                  </button>
                  {dashboards.length > 1 && (
                    <button onClick={() => deleteTab(tab.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors"
                      style={{ color: '#ef4444' }}
                      onMouseOver={e => { e.currentTarget.style.background = '#2d1515'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}>
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={addTab} className="p-1.5 rounded-md shrink-0 transition-colors" style={{ color: TEXT_SECONDARY }}
          onMouseOver={e => { e.currentTarget.style.color = ACCENT; }}
          onMouseOut={e => { e.currentTarget.style.color = TEXT_SECONDARY; }}
          title="Nouveau dashboard">
          <Plus size={14} />
        </button>
      </div>

      {/* 2-column grid */}
      <div className="px-6 pb-8 pt-4" style={{ display: 'grid', gridTemplateColumns: '1fr minmax(300px, 400px)', gap: '16px', alignItems: 'start' }}>

        {/* Left column */}
        <div className="space-y-4">
          {leftWidgets.map(w => (
            <WidgetCard key={w.instanceId} instance={w} collapsed={collapsed} toggleCollapse={toggleCollapse}
              removeWidget={removeWidget} renderContent={renderWidgetContent} openEditConfig={openEditConfig} />
          ))}
          <AddWidgetButton onClick={() => openCatalog(0)} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {rightWidgets.map(w => (
            <WidgetCard key={w.instanceId} instance={w} collapsed={collapsed} toggleCollapse={toggleCollapse}
              removeWidget={removeWidget} renderContent={renderWidgetContent} openEditConfig={openEditConfig} />
          ))}
          <AddWidgetButton onClick={() => openCatalog(1)} />
        </div>
      </div>

      {/* ── Widget Catalog Modal ── */}
      {catalogOpen && (
        <WidgetCatalogModal
          onSelect={onCatalogSelect}
          onClose={() => setCatalogOpen(false)}
        />
      )}

      {/* ── Widget Config Modal ── */}
      {configModal && (
        <WidgetConfigModal
          def={configModal.def}
          initialConfig={configModal.editInstance
            ? { ...configModal.editInstance.config, column: String(configModal.editInstance.column) }
            : { column: String(configModal.column) }}
          articles={articles}
          cases={cases}
          onConfirm={onConfigConfirm}
          onClose={() => setConfigModal(null)}
          isEdit={!!configModal.editInstance}
          formatSource={formatSource}
          onOpenArticle={onOpenArticle}
        />
      )}
    </div>
  );
}


/* ── Add Widget Button ── */
function AddWidgetButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-medium transition-colors"
      style={{ color: ACCENT, border: `1px dashed ${BORDER}` }}
      onMouseOver={e => { e.currentTarget.style.background = `${ACCENT}08`; }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Plus size={16} />
      Ajouter un widget
    </button>
  );
}


/* ═══════════════════════════════════════════════════════════════
   WIDGET CATALOG MODAL — "Ajouter des gadgets"
   3 categories, 2-column grid of widget cards, each with + button
   ═══════════════════════════════════════════════════════════════ */
function WidgetCatalogModal({ onSelect, onClose }: {
  onSelect: (def: DashWidgetDef) => void;
  onClose: () => void;
}) {
  const categories = ['start', 'content', 'data'] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-t-2xl overflow-hidden" style={{ background: BG_CARD, maxHeight: '70vh' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h4 className="text-[18px] font-bold" style={{ color: TEXT_HEADING }}>Ajouter des gadgets</h4>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: TEXT_SECONDARY }}><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-4 space-y-6" style={{ maxHeight: 'calc(70vh - 130px)' }}>
          {categories.map(cat => {
            const items = WIDGET_TYPES.filter(w => w.category === cat);
            return (
              <div key={cat}>
                <h5 className="text-[14px] font-bold mb-3" style={{ color: ACCENT }}>{CATEGORY_LABELS[cat]}</h5>
                <div className="grid grid-cols-2 gap-3">
                  {items.map(def => {
                    const Icon = def.icon;
                    return (
                      <button key={def.id}
                        onClick={() => onSelect(def)}
                        className="flex items-start gap-3 p-4 rounded-xl text-left transition-all"
                        style={{ background: BG_APP, border: `1px solid ${BORDER}` }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = ACCENT; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = BORDER; }}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
                          <Icon size={18} style={{ color: ACCENT }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold" style={{ color: TEXT_HEADING }}>{def.title}</div>
                          <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: TEXT_SECONDARY }}>{def.description}</div>
                        </div>
                        <Plus size={16} className="shrink-0 mt-1" style={{ color: ACCENT }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium" style={{ color: TEXT_SECONDARY }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   WIDGET CONFIG MODAL — Left: config form, Right: live preview
   Inoreader exact: Source, Affichage, Count, Refresh, Unread filter
   ═══════════════════════════════════════════════════════════════ */
function WidgetConfigModal({ def, initialConfig, articles, cases, onConfirm, onClose, isEdit, formatSource, onOpenArticle }: {
  def: DashWidgetDef;
  initialConfig: Record<string, any>;
  articles: Article[];
  cases: CaseData[];
  onConfirm: (config: Record<string, any>) => void;
  onClose: () => void;
  isEdit: boolean;
  formatSource: (s: string) => string;
  onOpenArticle: (id: string) => void;
}) {
  const [config, setConfig] = useState<Record<string, any>>(() => {
    const c: Record<string, any> = {};
    def.configFields?.forEach(f => { c[f.key] = initialConfig[f.key] ?? f.default; });
    return c;
  });

  // Load folders from API
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    listFolders().then(d => setFolders(d.folders.map(f => ({ id: f.id, name: f.name })))).catch(() => {});
  }, []);

  // Build source options: Fil d'actualité + Folders + Cases (never raw RSS sources)
  const sourceOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: 'all', label: 'Fil d\'actualité' },
    ];
    if (folders.length > 0) {
      folders.forEach(f => opts.push({ value: `folder:${f.id}`, label: `\ud83d\udcc1 ${f.name}` }));
    }
    if (cases.length > 0) {
      cases.forEach(c => opts.push({ value: `case:${c.id}`, label: `\ud83d\udcc2 ${c.name}` }));
    }
    return opts;
  }, [folders, cases]);

  // Inject dynamic sources into the source field
  const configFields = useMemo(() => {
    return def.configFields?.map(f => f.key === 'source' ? { ...f, options: sourceOptions } : f) || [];
  }, [def.configFields, sourceOptions]);

  const update = (key: string, value: any) => setConfig(prev => ({ ...prev, [key]: value }));
  const previewCount = Math.min(parseInt(String(config.count)) || 10, 5);

  // Filter articles by selected source for preview
  const isArticleWidget = configFields.some(f => f.key === 'source');
  const sourceLabel = useMemo(() => {
    if (!config.source || config.source === 'all') return 'Fil d\'actualité';
    const opt = sourceOptions.find(o => o.value === config.source);
    return opt?.label || config.source;
  }, [config.source, sourceOptions]);
  // Note: folder/case filtering would need API calls in production;
  // for the preview we show all articles (the real widget will filter server-side)
  const filteredArticles = config.source === 'all' ? articles : articles;
  const previewArticles = filteredArticles.slice(0, previewCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: BG_CARD, width: 800, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h4 className="text-[18px] font-bold" style={{ color: TEXT_HEADING }}>{def.title}</h4>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: TEXT_SECONDARY }}><X size={18} /></button>
        </div>

        {/* Body: left config, right preview */}
        <div className="flex" style={{ minHeight: 400 }}>
          {/* Left — Config form */}
          <div className="w-[320px] shrink-0 p-5 space-y-5 overflow-y-auto" style={{ borderRight: `1px solid ${BORDER}` }}>
            {configFields.map(field => (
              <div key={field.key}>
                <label className="text-[12px] font-semibold mb-1.5 block" style={{ color: TEXT_PRIMARY }}>{field.label}</label>
                {field.type === 'select' && field.options && (
                  <select value={config[field.key] ?? field.default}
                    onChange={e => update(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{ background: BG_APP, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }}>
                    {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {field.type === 'number' && (
                  <input type="number" value={config[field.key] ?? field.default} min={field.min} max={field.max}
                    onChange={e => update(field.key, parseInt(e.target.value) || field.default)}
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{ background: BG_APP, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }} />
                )}
                {field.type === 'text' && (
                  <input type="text" value={config[field.key] ?? ''} placeholder={def.title}
                    onChange={e => update(field.key, e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                    style={{ background: BG_APP, border: `1px solid ${BORDER}`, color: TEXT_PRIMARY }} />
                )}
                {field.type === 'toggle' && (
                  <button onClick={() => update(field.key, !config[field.key])}
                    className="flex items-center gap-2">
                    <div className="w-9 h-5 rounded-full relative transition-colors"
                      style={{ background: config[field.key] ? ACCENT : '#2a3a4a' }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: config[field.key] ? 18 : 2 }} />
                    </div>
                    <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{config[field.key] ? 'Oui' : 'Non'}</span>
                  </button>
                )}
              </div>
            ))}

          </div>

          {/* Right — Live preview (adapts to widget type) */}
          <div className="flex-1 overflow-y-auto" style={{ background: BG_APP }}>
            {isArticleWidget ? (
              <>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold" style={{ color: TEXT_HEADING }}>
                      {sourceLabel}
                    </span>
                    <span className="text-[12px] font-medium px-1.5 py-0.5 rounded" style={{ background: `${ACCENT}20`, color: ACCENT }}>{filteredArticles.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px]" style={{ color: TEXT_SECONDARY }}>‹</span>
                    <span className="text-[11px]" style={{ color: TEXT_SECONDARY }}>›</span>
                  </div>
                </div>
                <div>
                  {config.view === 'cards' ? (
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {previewArticles.map(a => {
                        const imgUrl = (a as any).image_url;
                        return (
                          <div key={a.id} className="rounded-lg overflow-hidden" style={{ background: BG_CARD }}>
                            <div className="relative h-20 overflow-hidden">
                              {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
                              <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 60%)' }} />
                              <p className="absolute bottom-1.5 left-2 right-2 text-[10px] font-semibold leading-tight line-clamp-2 text-white">{a.title}</p>
                            </div>
                            <div className="px-2 py-1.5 flex items-center justify-between">
                              {!config.hideSource && <span className="text-[9px] truncate" style={{ color: ACCENT }}>{formatSource(a.source_id)}</span>}
                              {a.pub_date && <span className="text-[9px]" style={{ color: TEXT_SECONDARY }}>{timeAgo(a.pub_date)}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    previewArticles.map(a => (
                      <div key={a.id} className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold line-clamp-1" style={{ color: TEXT_HEADING }}>{a.title}</p>
                          {!config.hideSource && <span className="text-[11px]" style={{ color: TEXT_SECONDARY }}>{formatSource(a.source_id)}</span>}
                        </div>
                        {a.pub_date && <span className="text-[11px] shrink-0" style={{ color: TEXT_SECONDARY }}>{timeAgo(a.pub_date)}</span>}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              /* Non-article widget preview */
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <def.icon size={20} style={{ color: ACCENT }} />
                  <span className="text-[15px] font-semibold" style={{ color: TEXT_HEADING }}>{def.title}</span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: TEXT_SECONDARY }}>{def.description}</p>
                {/* Mini preview based on type */}
                {def.id === 'stats' && (
                  <div className="space-y-2 pt-3">
                    {[
                      { l: "Articles aujourd'hui", v: articles.filter(a => a.pub_date && (Date.now() - new Date(a.pub_date).getTime()) < 86400000).length },
                      { l: 'Sources actives', v: new Set(articles.map(a => a.source_id)).size },
                      { l: 'Pays couverts', v: new Set(articles.flatMap(a => a.country_codes)).size },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <span className="text-[12px]" style={{ color: TEXT_SECONDARY }}>{s.l}</span>
                        <span className="text-[14px] font-bold" style={{ color: ACCENT }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {def.id === 'alerts' && (
                  <div className="space-y-1 pt-3">
                    {articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high').slice(0, 3).map(a => (
                      <div key={a.id} className="flex items-center gap-2 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.threat_level === 'critical' ? '#ef4444' : '#f97316' }} />
                        <span className="text-[12px] line-clamp-1" style={{ color: TEXT_PRIMARY }}>{a.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!['stats', 'alerts'].includes(def.id) && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <def.icon size={32} style={{ color: ACCENT, opacity: 0.3 }} />
                      <p className="text-[11px] mt-2" style={{ color: TEXT_SECONDARY }}>Aper\u00e7u disponible après ajout</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium" style={{ color: TEXT_SECONDARY }}>Fermer</button>
          <button onClick={() => onConfirm(config)}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: ACCENT }}>
            {isEdit ? 'Enregistrer' : 'Ajouter au Tableau de bord'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   WIDGET CARD — individual widget on the dashboard
   ═══════════════════════════════════════════════════════════════ */
function WidgetCard({ instance, collapsed, toggleCollapse, removeWidget, renderContent, openEditConfig }: {
  instance: WidgetInstance;
  collapsed: Set<string>;
  toggleCollapse: (id: string) => void;
  removeWidget: (id: string) => void;
  renderContent: (instance: WidgetInstance) => React.ReactNode;
  openEditConfig: (instance: WidgetInstance) => void;
}) {
  const def = getWidgetDef(instance.typeId);
  if (!def) return null;
  const isCollapsed = collapsed.has(instance.instanceId);
  const Icon = def.icon;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: BG_CARD, border: `1px solid ${BORDER}` }}>
      {/* Header — drag handle + title + actions */}
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ borderBottom: isCollapsed ? 'none' : `1px solid ${BORDER}` }}
        onClick={() => toggleCollapse(instance.instanceId)}>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px]" style={{ color: TEXT_SECONDARY }}>—</span>
          <Icon size={16} style={{ color: ACCENT }} />
          <span className="text-[14px] font-semibold" style={{ color: TEXT_HEADING }}>{instance.config.title || def.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {def.configFields && (
            <button onClick={e => { e.stopPropagation(); openEditConfig(instance); }}
              className="p-1.5 rounded-md transition-colors" style={{ color: TEXT_SECONDARY }} title="Configurer">
              <Settings size={13} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); removeWidget(instance.instanceId); }}
            className="p-1.5 rounded-md transition-colors" style={{ color: TEXT_SECONDARY }} title="Retirer">
            <X size={13} />
          </button>
          {isCollapsed ? <ChevronDown size={14} style={{ color: TEXT_SECONDARY }} /> : <ChevronUp size={14} style={{ color: TEXT_SECONDARY }} />}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && <div>{renderContent(instance)}</div>}
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
