/**
 * WidgetCatalog — config-driven widget system.
 *
 * Architecture:
 *   Widget = RendererType + DataSource + FieldMapping
 *   3 generic renderers (List, Chart, Gauge) cover 30+ widgets.
 *   ~10 widgets with complex article-derived logic stay as custom code.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Globe, BarChart2, Newspaper, AlertTriangle, TrendingUp,
  Shield, DollarSign, Swords, Radio, Activity, Scale,
  Anchor, Zap, Cloud, FlaskConical, Plane,
  Bitcoin, LineChart, Users, Target, Map, Crosshair,
  Package, Landmark, Cpu, Coins, BarChart3, Rss, BookOpen,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { api } from '@/v2/lib/api';
import type { Article } from '@/v2/lib/constants';
import { capitalize, timeAgo, FLAGS } from '@/v2/lib/constants';
import {
  computeSentimentByDay, overallSentimentScore, computeCountryMatrix,
  computeTopEntities, computeAlertVelocity, computeSourceCoverage, computeThemeRadar,
  computeCountryThemeMatrix, COUNTRY_NAMES,
} from '@/v2/lib/sentiment';
import LiveMap from '../LiveMap';
import type { WidgetDef } from '../WidgetGrid';
import { ListRenderer, ChartRenderer, GaugeRenderer, CHART_COLORS } from './renderers';
import { LIST_WIDGETS, CHART_WIDGETS, GAUGE_WIDGETS } from './widget-configs';
import { useArticleReader } from '@/v2/hooks/useArticleReader';
import { useTheme } from '@/v2/lib/theme';

// ── "Voir plus" for widget lists ──────────────────────────────
const PAGE = 20;

function useShowMore<T>(items: T[], pageSize = PAGE) {
  const [limit, setLimit] = useState(pageSize);
  const visible = items.slice(0, limit);
  const hasMore = items.length > limit;
  const showMore = useCallback(() => setLimit(l => l + pageSize), [pageSize]);
  // Reset when items change identity (e.g. different widget)
  useEffect(() => setLimit(pageSize), [items.length, pageSize]);
  return { visible, hasMore, showMore, total: items.length };
}

function ShowMoreBtn({ hasMore, onClick, total, shown }: { hasMore: boolean; onClick: () => void; total: number; shown: number }) {
  if (!hasMore) return null;
  return (
    <button onClick={onClick} className="w-full py-1.5 text-[10px] text-slate-400 hover:text-[#42d3a5] transition-colors">
      Voir plus ({shown}/{total})
    </button>
  );
}

// ── Full widget catalog ────────────────────────────────────────
export const FULL_CATALOG: WidgetDef[] = [
  // General
  { id: 'kpis',        title: 'Indicateurs Cles',        icon: Activity,       category: 'General',       defaultW: 12, defaultH: 2,  minH: 2, minW: 6 },
  { id: 'map',         title: 'Carte Mondiale',           icon: Globe,          category: 'General',       defaultW: 8,  defaultH: 8,  minH: 4, minW: 4 },
  { id: 'alerts',      title: 'Alertes Critiques',        icon: AlertTriangle,  category: 'General',       defaultW: 4,  defaultH: 8,  minH: 3, minW: 3 },
  { id: 'news',        title: "Fil d'actualites",         icon: Newspaper,      category: 'General',       defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
  // Analyse
  { id: 'themes',      title: 'Thematiques',              icon: BarChart2,      category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'sentiment',   title: 'Sentiment Global',         icon: TrendingUp,     category: 'Analyse',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'threats',     title: 'Niveau de Menace',         icon: Shield,         category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'alert-velocity', title: 'Velocite Alertes (15j)', icon: TrendingUp,   category: 'Analyse',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'sources',     title: 'Top Sources',              icon: Radio,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'countries',   title: 'Top Pays',                 icon: Globe,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  // Thematique
  { id: 'conflict',    title: 'Conflit & Militaire',      icon: Swords,         category: 'Thematique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'economic',    title: 'Economie & Finance',       icon: DollarSign,     category: 'Thematique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'diplomatic',  title: 'Diplomatie & Politique',   icon: Scale,          category: 'Thematique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  // Sources Live
  { id: 'seismology',  title: 'Seismes',                  icon: Activity,       category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'maritime',    title: 'Alertes Maritimes',        icon: Anchor,         category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'natural',     title: 'Evenements Naturels',      icon: Cloud,          category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'aviation',    title: 'Aviation',                 icon: Plane,          category: 'Sources Live',  defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'minerals',    title: 'Minerais Critiques',       icon: FlaskConical,   category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  // Marches
  { id: 'feargreed',   title: 'Fear & Greed Index',       icon: LineChart,      category: 'Marches',       defaultW: 4,  defaultH: 4,  minH: 3, minW: 3 },
  { id: 'fredrates',   title: 'Taux US (10Y)',            icon: LineChart,      category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'commodities', title: 'Matieres Premieres',       icon: Package,        category: 'Marches',       defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'etfflows',    title: 'Tracker ETF',              icon: BarChart3,      category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'stockindex',  title: 'Indices US',               icon: Landmark,       category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'globalindex', title: 'Indices Mondiaux',         icon: Globe,          category: 'Marches',       defaultW: 6,  defaultH: 8,  minH: 5, minW: 4 },
  // KPI Analytiques
  { id: 'countrymatrix', title: 'Risque par Pays',         icon: Map,            category: 'KPI',           defaultW: 12, defaultH: 8,  minH: 5, minW: 6 },
  { id: 'countrythemes', title: 'Pays x Themes',          icon: Globe,          category: 'KPI',           defaultW: 12, defaultH: 8,  minH: 5, minW: 6 },
  { id: 'topentities',  title: 'Top Entites',             icon: Target,         category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'velocity',     title: 'Alertes par Jour',        icon: Crosshair,      category: 'KPI',           defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'srccover',     title: 'Volume par Source',       icon: Radio,          category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'themeradar',   title: 'Repartition Themes',     icon: Activity,       category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'sectors',      title: 'Secteurs Intel',          icon: BarChart2,      category: 'KPI',           defaultW: 6,  defaultH: 8,  minH: 4, minW: 4 },
  // Veille
  { id: 'hackernews',   title: 'Hacker News',             icon: BookOpen,       category: 'Veille',        defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
];

// ── Feed catalog cache (5 min TTL) ────────────────────────────
let _catalogCache: { data: WidgetDef[]; ts: number } | null = null;

export async function buildCatalogWithFeeds(): Promise<WidgetDef[]> {
  if (_catalogCache && Date.now() - _catalogCache.ts < 5 * 60_000) return _catalogCache.data;
  try {
    const { listFeeds, listCatalog } = await import('@/v2/lib/ai-feeds-api');
    const [{ feeds }, { sources }] = await Promise.all([listFeeds(), listCatalog()]);

    // AI Feed widgets
    const feedWidgets: WidgetDef[] = feeds.map(f => ({
      id: `ai-feed-${f.id}`, title: f.name, icon: Rss, category: 'AI Feeds',
      defaultW: 4, defaultH: 6, minW: 3, minH: 3,
    }));

    // RSS widgets: each source appears in TWO categories — by theme AND by country
    const rssWidgets: WidgetDef[] = [];
    const seen = new Set<string>();
    for (const s of sources) {
      const wid = `rss-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (seen.has(wid)) continue;
      seen.add(wid);

      const tag = s.tags?.[0];
      const country = s.country || s.continent || 'Autre';
      const isGeneric = !tag || tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'actualites';

      const category = isGeneric ? `RSS ${country}` : `RSS ${tag}`;

      rssWidgets.push({
        id: wid, title: s.name, icon: Rss, category,
        defaultW: 4, defaultH: 6, minW: 3, minH: 3,
      });
    }

    const result = [...FULL_CATALOG, ...feedWidgets, ...rssWidgets];
    _catalogCache = { data: result, ts: Date.now() };
    return result;
  } catch { return FULL_CATALOG; }
}

export function invalidateCatalogCache() { _catalogCache = null; }

// ═══════════════════════════════════════════════════════════════
// MAIN RENDERER — dispatches to config-driven or custom renderers
// ═══════════════════════════════════════════════════════════════

export function renderSharedWidget(
  id: string,
  articles: Article[],
  stats: { total: number; by_theme: Record<string, number>; by_threat: Record<string, number>; by_source: Record<string, number> } | null,
  prefix: string = 'sw',
  t?: { textHeading: string; border: string; textSecondary: string; bgCard: string; textPrimary: string; accent: string; bgApp: string; bgSidebar: string },
): React.ReactNode {
  // Fallback to golden theme defaults if t not provided
  const _t = t || { textHeading: '#e8e2cc', border: '#262a1e', textSecondary: '#7a7564', bgCard: '#1a1d16', textPrimary: '#b8b098', accent: '#d4b85c', bgApp: '#121410', bgSidebar: '#0e100b' };

  // 1. AI Feed widgets
  if (id.startsWith('ai-feed-') && id !== 'ai-feed-placeholder') {
    return <AIFeedWidget feedId={id.replace('ai-feed-', '')} />;
  }

  // 1b. RSS source widgets — fetch articles from API by source_id
  if (id.startsWith('rss-')) {
    return <RssSourceWidget widgetId={id} articles={articles} />;
  }

  // 2. Config-driven: List renderer
  if (LIST_WIDGETS[id]) return <ListRenderer config={LIST_WIDGETS[id]} />;

  // 3. Config-driven: Chart renderer
  if (CHART_WIDGETS[id]) return <ChartRenderer config={CHART_WIDGETS[id]} />;

  // 4. Config-driven: Gauge renderer
  if (GAUGE_WIDGETS[id]) return <GaugeRenderer config={GAUGE_WIDGETS[id]} stats={stats} />;

  // 5. Custom article-derived widgets
  const alerts = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high');

  switch (id) {

    case 'kpis':
      return (
        <div className="flex gap-2 p-2 h-full items-center">
          {[
            { l: 'Documents', v: stats?.total || 0 },
            { l: 'Critiques', v: stats?.by_threat['critical'] || 0 },
            { l: 'Elevees', v: stats?.by_threat['high'] || 0 },
            { l: 'Themes', v: Object.keys(stats?.by_theme || {}).length },
            { l: 'Sources', v: Object.keys(stats?.by_source || {}).length },
            { l: 'Sentiment', v: `${overallSentimentScore(stats?.by_threat || {})}` },
          ].map((k, i) => (
            <div key={i} className="flex-1 bg-slate-50 rounded-lg py-2 px-3 text-center">
              <div className="text-lg font-extrabold text-slate-900">{typeof k.v === 'number' ? k.v.toLocaleString() : k.v}</div>
              <div className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{k.l}</div>
            </div>
          ))}
        </div>
      );

    case 'map':
      return <div className="p-1 h-full">{articles.length > 0 ? <LiveMap articles={articles} /> : <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 text-xs">Chargement...</div>}</div>;

    case 'alerts':
      return <AlertsList alerts={alerts} />;

    case 'news':
      return <NewsList articles={articles} />;

    case 'themes': {
      const data = Object.entries(stats?.by_theme || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: capitalize(n), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={65} /><Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${_t.textHeading}`, fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
    }

    case 'sentiment': {
      const sentData = computeSentimentByDay(articles);
      return <div className="p-2 h-full"><ResponsiveContainer><AreaChart data={sentData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`${prefix}P`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.25} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
          <linearGradient id={`${prefix}N`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.25} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${_t.textHeading}`, fontSize: 12 }} />
        <Area type="monotone" dataKey="positive" stroke="#34d399" fill={`url(#${prefix}P)`} strokeWidth={2} />
        <Area type="monotone" dataKey="negative" stroke="#f87171" fill={`url(#${prefix}N)`} strokeWidth={2} />
        <Area type="monotone" dataKey="smoothed" stroke="#8b5cf6" fill="none" strokeWidth={2} strokeDasharray="6 3" name="Moyenne 3j" />
      </AreaChart></ResponsiveContainer></div>;
    }

    case 'sources': {
      const seen = new Set<string>();
      const filtered = Object.entries(stats?.by_source || {})
        .filter(([n]) => n.startsWith('catalog_'))
        .sort((a, b) => b[1] - a[1])
        .map(([n, v]) => ({ name: capitalize(n.replace(/^catalog_/g, '').replace(/_/g, ' ')), value: v }))
        .filter(d => { if (seen.has(d.name)) return false; seen.add(d.name); return true; })
        .slice(0, 8);
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={filtered} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={10}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569' }} width={80} /><Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${_t.textHeading}`, fontSize: 12 }} /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
    }

    case 'countries': {
      const agg = articles.reduce<Record<string, number>>((acc, a) => { for (const c of a.country_codes) acc[c] = (acc[c] || 0) + 1; return acc; }, {});
      const data = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => ({ name: `${FLAGS[c] || ''} ${COUNTRY_NAMES[c] || c}`, value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={12}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} width={55} /><Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${_t.textHeading}`, fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
    }

    case 'conflict': case 'economic': case 'diplomatic': {
      const tm: Record<string, string[]> = { conflict: ['conflict', 'military'], economic: ['economic', 'tech'], diplomatic: ['diplomatic', 'protest'] };
      const pool = articles.filter(a => (tm[id] || []).includes(a.theme));
      return <ThemeArticleList articles={pool} />;
    }

    // ── KPI Analytiques (article-derived, complex) ──────────────

    case 'countrymatrix':
      return <CountryMatrixWidget rows={computeCountryMatrix(articles)} />;

    case 'countrythemes':
      return <CountryThemesWidget articles={articles} stats={stats} />;

    case 'topentities': {
      const rows = computeTopEntities(articles);
      if (!rows.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune entite</div>;
      const persons = rows.filter(e => e.type === 'person').slice(0, 8);
      const orgs = rows.filter(e => e.type === 'org').slice(0, 8);
      const topCountries = articles.reduce<Record<string, number>>((acc, a) => { for (const c of a.country_codes) acc[c] = (acc[c] || 0) + 1; return acc; }, {});
      const countrySorted = Object.entries(topCountries).sort((a, b) => b[1] - a[1]).slice(0, 8);
      const topThemes = Object.entries(stats?.by_theme || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);

      const Badge = ({ type }: { type: string }) => {
        const c: Record<string, string> = { person: 'bg-blue-100 text-blue-600', org: 'bg-purple-100 text-purple-600', country: 'bg-emerald-100 text-emerald-600', theme: 'bg-amber-100 text-amber-600' };
        const l: Record<string, string> = { person: 'Pers.', org: 'Org.', country: 'Pays', theme: 'Theme' };
        return <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded ${c[type] || ''}`}>{l[type] || type}</span>;
      };
      const Row = ({ name, count, type, trend }: { name: string; count: number; type: string; trend?: number }) => (
        <div className="flex items-center gap-1.5 py-1 px-1.5 rounded border border-transparent hover:border-slate-200">
          <Badge type={type} />
          <span className="text-[10px] font-semibold text-slate-800 flex-1 truncate">{name}</span>
          <span className="text-[10px] font-bold text-slate-500 w-6 text-right">{count}</span>
          {trend !== undefined && <span className={`text-[8px] font-bold w-8 text-right ${trend > 0 ? 'text-red-500' : trend < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '='}</span>}
        </div>
      );

      return (
        <div className="overflow-y-auto h-full p-2 space-y-2">
          {persons.length > 0 && <div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Personnalites</div>{persons.map(e => <Row key={e.name} name={e.name} count={e.count} type="person" trend={e.trend} />)}</div>}
          {orgs.length > 0 && <div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Organisations</div>{orgs.map(e => <Row key={e.name} name={e.name} count={e.count} type="org" trend={e.trend} />)}</div>}
          {countrySorted.length > 0 && <div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pays</div>{countrySorted.map(([c, v]) => <Row key={c} name={`${FLAGS[c] || ''} ${COUNTRY_NAMES[c] || c}`} count={v} type="country" />)}</div>}
          {topThemes.length > 0 && <div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Thematiques</div>{topThemes.map(([t, v]) => <Row key={t} name={capitalize(t)} count={v} type="theme" />)}</div>}
        </div>
      );
    }

    case 'velocity': {
      const data = computeAlertVelocity(articles);
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${_t.textHeading}`, fontSize: 12 }} /><Bar dataKey="high" stackId="a" fill="#f97316" /><Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>;
    }

    case 'srccover':
      return <SourceCoverWidget articles={articles} />;

    case 'themeradar': {
      const data = computeThemeRadar(articles).slice(0, 10);
      const maxCount = data[0]?.count || 1;
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1">
          {data.map(d => (
            <div key={d.theme} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-700 font-medium w-20 truncate">{d.theme}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-[#42d3a5]" style={{ width: `${(d.count / maxCount) * 100}%` }} />
              </div>
              <span className="text-[9px] text-slate-500 w-8 text-right">{d.count}</span>
              <span className="text-[8px] text-slate-400 w-8 text-right">{d.pct}%</span>
            </div>
          ))}
        </div>
      );
    }

    case 'sectors':
      return <SectorsWidget articles={articles} />;

    default:
      return null;
  }
}

// ── Paginated widget sub-components ───────────────────────────

function AlertsList({ alerts }: { alerts: Article[] }) {
  const { visible, hasMore, showMore, total } = useShowMore(alerts);
  const openArticle = useArticleReader();
  if (!alerts.length) return <div className="text-center text-xs text-slate-400 py-6">Aucune alerte</div>;
  return (
    <div className="overflow-y-auto h-full p-2 space-y-1.5">
      {visible.map((a, i) => (
        <button key={a.id || i} onClick={() => openArticle(a.id)} className="block w-full text-left p-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${a.threat_level === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{a.threat_level}</span>
            <span className="text-[9px] text-slate-400 ml-auto">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
          </div>
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
        </button>
      ))}
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

function NewsList({ articles }: { articles: Article[] }) {
  const { visible, hasMore, showMore, total } = useShowMore(articles);
  const openArticle = useArticleReader();
  return (
    <div className="overflow-y-auto h-full p-2 space-y-1.5">
      {visible.map((a, i) => (
        <button key={a.id || i} onClick={() => openArticle(a.id)} className="block w-full text-left pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
          <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
          <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.theme}</span>
          <span className="text-[8px] text-slate-400 ml-2">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
        </button>
      ))}
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

function ThemeArticleList({ articles }: { articles: Article[] }) {
  const { visible, hasMore, showMore, total } = useShowMore(articles);
  const openArticle = useArticleReader();
  if (!articles.length) return <div className="text-center text-xs text-slate-400 py-6">Aucun article</div>;
  return (
    <div className="overflow-y-auto h-full p-2 space-y-1.5">
      <div className="text-[10px] text-slate-400 font-semibold">{articles.length} articles</div>
      {visible.map((a, i) => (
        <button key={a.id || i} onClick={() => openArticle(a.id)} className="block w-full text-left p-1.5 rounded-lg border border-transparent hover:border-slate-200 transition-colors">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {a.country_codes.slice(0, 3).map(c => <span key={c} className="text-[10px]">{FLAGS[c] || c}</span>)}
            <span className="text-[8px] text-slate-400 ml-auto">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
          </div>
        </button>
      ))}
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

// ── Paginated table widgets ───────────────────────────────────

function CountryMatrixWidget({ rows }: { rows: ReturnType<typeof computeCountryMatrix> }) {
  const { visible, hasMore, showMore, total } = useShowMore(rows);
  if (!rows.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee pays</div>;
  const barW = (v: number) => `${Math.min(v, 100)}%`;
  const barColor = (v: number) => v > 60 ? '#ef4444' : v > 35 ? '#f97316' : v > 15 ? '#eab308' : '#22c55e';
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-white z-10">
          <tr className="border-b border-slate-200">
            <th className="text-left p-1.5 font-semibold text-slate-500">Pays</th>
            <th className="text-center p-1.5 font-semibold text-slate-500 w-10">Art.</th>
            <th className="text-center p-1.5 font-semibold text-slate-500">Polit.</th>
            <th className="text-center p-1.5 font-semibold text-slate-500">Eco.</th>
            <th className="text-center p-1.5 font-semibold text-slate-500">Milit.</th>
            <th className="text-center p-1.5 font-semibold text-slate-500">Soc.</th>
            <th className="text-center p-1.5 font-semibold text-slate-500" title="Score de risque (0-100)">Risque</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.code} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="p-1.5 font-medium text-slate-800 whitespace-nowrap">{r.flag} {r.name}</td>
              <td className="text-center p-1.5 font-bold text-slate-700">{r.total}</td>
              {[r.political, r.economic, r.military, r.social, r.geopolitical].map((v, j) => (
                <td key={j} className="p-1.5">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{ width: barW(v), background: barColor(v) }} /></div>
                    <span className="text-[9px] font-mono w-6 text-right" style={{ color: barColor(v) }}>{v}</span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

function CountryThemesWidget({ articles, stats }: { articles: Article[]; stats: any }) {
  const { rows, allThemes } = computeCountryThemeMatrix(articles);
  const { visible, hasMore, showMore, total } = useShowMore(rows);
  if (!rows.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee</div>;
  const topThemes = allThemes.slice(0, 8);
  const maxVal = Math.max(...rows.flatMap(r => topThemes.map(t => r.themes[t] || 0)), 1);
  const cellBg = (v: number) => {
    if (v === 0) return 'transparent';
    const intensity = Math.min(v / maxVal, 1);
    if (intensity > 0.6) return '#fca5a5';
    if (intensity > 0.3) return '#fdba74';
    if (intensity > 0.1) return '#fde68a';
    return '#d1fae5';
  };
  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-[9px] border-collapse">
        <thead className="sticky top-0 bg-white z-10">
          <tr>
            <th className="text-left p-1 font-semibold text-slate-500 sticky left-0 bg-white">Pays</th>
            <th className="text-center p-1 font-semibold text-slate-500 w-8">Tot</th>
            <th className="text-center p-1 font-semibold text-slate-500 w-8">Src</th>
            {topThemes.map(t => <th key={t} className="text-center p-1 font-semibold text-slate-500 w-10" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: 60 }}>{capitalize(t)}</th>)}
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.code} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="p-1 font-medium text-slate-800 whitespace-nowrap sticky left-0 bg-white">{r.flag} {r.name}</td>
              <td className="text-center p-1 font-bold text-slate-700">{r.total}</td>
              <td className="text-center p-1 text-slate-500">{r.sources}</td>
              {topThemes.map(t => {
                const v = r.themes[t] || 0;
                return <td key={t} className="text-center p-1 font-mono" style={{ background: cellBg(v), color: v > 0 ? '#1e293b' : '#cbd5e1' }}>{v || '-'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

function SourceCoverWidget({ articles }: { articles: Article[] }) {
  const data = computeSourceCoverage(articles);
  const { visible, hasMore, showMore, total } = useShowMore(data, 15);
  if (!data.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune source</div>;
  const maxArt = data[0]?.articles || 1;
  return (
    <div className="overflow-y-auto h-full p-2">
      {visible.map((s, i) => (
        <div key={`${s.name}-${i}`} className="flex items-center gap-2 py-1">
          <span className="text-[10px] text-slate-700 font-medium w-24 truncate">{s.name}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full bg-[#42d3a5]" style={{ width: `${(s.articles / maxArt) * 100}%` }} /></div>
          <span className="text-[9px] text-slate-500 w-6 text-right">{s.articles}</span>
          <span className="text-[8px] text-slate-400 w-8 text-right">{s.themes}th</span>
        </div>
      ))}
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

// ── Sectors Intel widget ──────────────────────────────────────

function SectorsWidget({ articles }: { articles: Article[] }) {
  // Group by family -> section
  const tree = useMemo(() => {
    const fam: Record<string, { total: number; sections: Record<string, number> }> = {};
    for (const a of articles) {
      if (!a.family) continue;
      if (!fam[a.family]) fam[a.family] = { total: 0, sections: {} };
      fam[a.family].total++;
      const sec = a.section || 'Autre';
      fam[a.family].sections[sec] = (fam[a.family].sections[sec] || 0) + 1;
    }
    return Object.entries(fam)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({
        name: capitalize(name),
        total: data.total,
        sections: Object.entries(data.sections).sort((a, b) => b[1] - a[1]),
      }));
  }, [articles]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!tree.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee</div>;
  const maxTotal = tree[0]?.total || 1;

  return (
    <div className="overflow-y-auto h-full p-2 space-y-0.5">
      {tree.map(fam => {
        const open = expanded.has(fam.name);
        return (
          <div key={fam.name}>
            <button onClick={() => setExpanded(prev => { const n = new Set(prev); if (n.has(fam.name)) n.delete(fam.name); else n.add(fam.name); return n; })}
              className="w-full flex items-center gap-2 py-1 hover:bg-slate-50 rounded">
              <span className="text-[8px] text-slate-400">{open ? '\u25BC' : '\u25B6'}</span>
              <span className="text-[10px] font-bold text-slate-800 w-20 truncate">{fam.name}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div className="h-2 rounded-full bg-[#42d3a5]" style={{ width: `${(fam.total / maxTotal) * 100}%` }} />
              </div>
              <span className="text-[9px] font-bold text-slate-600 w-8 text-right">{fam.total}</span>
            </button>
            {open && (
              <div className="ml-5 space-y-0.5 mb-1">
                {fam.sections.map(([sec, count]) => (
                  <div key={sec} className="flex items-center gap-2 py-0.5">
                    <span className="text-[9px] text-slate-500 w-28 truncate">{sec}</span>
                    <div className="flex-1 bg-slate-50 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${(count / fam.total) * 100}%` }} />
                    </div>
                    <span className="text-[8px] text-slate-400 w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── RSS source widget ─────────────────────────────────────────

function RssSourceWidget({ widgetId }: { widgetId: string; articles: Article[] }) {
  const openArticle = useArticleReader();
  const slug = widgetId.replace('rss-', '');
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sourceId = `catalog_${slug.replace(/-/g, '_')}`;
    api<{ articles: Article[]; total: number }>(`/articles/v1/search?source_id=${encodeURIComponent(sourceId)}&limit=50`)
      .then(r => setItems(r.articles))
      .catch(() => {})
      .finally(() => setLoading(false));
    // Track view for priority scoring (fire-and-forget)
    api(`/ai-feeds/catalog/track-view`, { method: 'POST', body: JSON.stringify({ name: slug.replace(/-/g, ' ') }) }).catch(() => {});
  }, [slug]);

  const { visible, hasMore, showMore, total } = useShowMore(items);

  if (loading) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Chargement...</div>;
  if (!items.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Pas d'articles pour cette source</div>;

  return (
    <div className="overflow-y-auto h-full p-2 space-y-1">
      <div className="text-[9px] text-slate-400 font-medium mb-1">{items.length} articles</div>
      {visible.map((a, i) => (
        <button key={a.id || i} onClick={() => openArticle(a.id)} className="block w-full text-left pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
          <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.theme}</span>
            {a.threat_level && a.threat_level !== 'info' && (
              <span className={`text-[8px] font-bold uppercase ${a.threat_level === 'critical' ? 'text-red-500' : a.threat_level === 'high' ? 'text-orange-500' : 'text-yellow-600'}`}>{a.threat_level}</span>
            )}
            <span className="text-[8px] text-slate-400">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
          </div>
        </button>
      ))}
      <ShowMoreBtn hasMore={hasMore} onClick={showMore} total={total} shown={visible.length} />
    </div>
  );
}

// ── AI Feed widget (special: dynamic import + fallback) ─────────

function AIFeedWidget({ feedId }: { feedId: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    import('@/v2/lib/ai-feeds-api').then(async ({ listFeedArticles, getFeed, previewQuery }) => {
      try {
        const { getLimit } = await import('@/v2/lib/display-settings');
        const data = await listFeedArticles(feedId, { limit: getLimit('widgetArticleLimit') });
        if (data.total > 0) { setArticles(data.articles); setTotal(data.total); setLoading(false); return; }
        const feed = await getFeed(feedId);
        if (feed.query?.layers?.length) {
          const preview = await previewQuery(feed.query);
          setArticles(preview.articles.map((a: any) => ({ ...a, article_url: a.article_url, relevance_score: 0 })));
          setTotal(preview.total);
        }
      } catch (e: any) { setError(e?.message || 'Erreur'); }
      setLoading(false);
    });
  }, [feedId]);

  if (loading) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Chargement...</div>;
  if (error) return <div className="flex items-center justify-center h-full text-xs text-red-400">{error}</div>;

  return (
    <div className="overflow-y-auto h-full p-2 space-y-1">
      {total > 0 && <div className="text-[9px] text-slate-400 font-medium mb-1">{total} articles</div>}
      {articles.map((a: any) => (
        <a key={a.id || a.article_url} href={a.article_url} target="_blank" rel="noopener noreferrer" className="block pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
          <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.source_name}</span>
            {a.threat_level && <span className={`text-[8px] font-bold uppercase ${a.threat_level === 'critical' ? 'text-red-500' : a.threat_level === 'high' ? 'text-orange-500' : 'text-slate-400'}`}>{a.threat_level}</span>}
            <span className="text-[8px] text-slate-400">{a.published_at ? timeAgo(a.published_at) : ''}</span>
          </div>
        </a>
      ))}
      {articles.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Pas d'articles</div>}
    </div>
  );
}
