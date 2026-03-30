/**
 * WidgetCatalog — config-driven widget system.
 *
 * Architecture:
 *   Widget = RendererType + DataSource + FieldMapping
 *   3 generic renderers (List, Chart, Gauge) cover 30+ widgets.
 *   ~10 widgets with complex article-derived logic stay as custom code.
 */
import { useState, useEffect } from 'react';
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
  { id: 'sources',     title: 'Sources Actives',          icon: Radio,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'countries',   title: 'Pays actifs',              icon: Globe,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
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
  { id: 'countrymatrix', title: 'Stabilite Pays',         icon: Map,            category: 'KPI',           defaultW: 12, defaultH: 8,  minH: 5, minW: 6 },
  { id: 'countrythemes', title: 'Pays x Themes',          icon: Globe,          category: 'KPI',           defaultW: 12, defaultH: 8,  minH: 5, minW: 6 },
  { id: 'topentities',  title: 'Top Entites',             icon: Target,         category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'velocity',     title: 'Velocite Alertes',        icon: Crosshair,      category: 'KPI',           defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'srccover',     title: 'Couverture Sources',      icon: Radio,          category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'themeradar',   title: 'Radar Thematique',        icon: Activity,       category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  // Veille
  { id: 'predictions',  title: 'Marches Predictifs',      icon: TrendingUp,     category: 'Veille',        defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'hackernews',   title: 'Hacker News',             icon: BookOpen,       category: 'Veille',        defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
];

// ── Feed catalog cache ─────────────────────────────────────────
let _catalogCache: { data: WidgetDef[]; ts: number } | null = null;

export async function buildCatalogWithFeeds(): Promise<WidgetDef[]> {
  if (_catalogCache && Date.now() - _catalogCache.ts < 30_000) return _catalogCache.data;
  try {
    const { listFeeds } = await import('@/v2/lib/ai-feeds-api');
    const { feeds } = await listFeeds();
    const feedWidgets: WidgetDef[] = feeds.map(f => ({
      id: `ai-feed-${f.id}`, title: f.name, icon: Rss, category: 'AI Feeds',
      defaultW: 4, defaultH: 6, minW: 3, minH: 3,
    }));
    const result = [...FULL_CATALOG, ...feedWidgets];
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
): React.ReactNode {

  // 1. AI Feed widgets
  if (id.startsWith('ai-feed-') && id !== 'ai-feed-placeholder') {
    return <AIFeedWidget feedId={id.replace('ai-feed-', '')} />;
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
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          {alerts.slice(0, 15).map((a, i) => (
            <a key={a.id || i} href={a.link} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${a.threat_level === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{a.threat_level}</span>
                <span className="text-[9px] text-slate-400 ml-auto">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
              </div>
              <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
            </a>
          ))}
          {alerts.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Aucune alerte</div>}
        </div>
      );

    case 'news':
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          {articles.slice(0, 20).map((a, i) => (
            <a key={a.id || i} href={a.link} target="_blank" rel="noopener noreferrer" className="block pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
              <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
              <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.theme}</span>
              <span className="text-[8px] text-slate-400 ml-2">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
            </a>
          ))}
        </div>
      );

    case 'themes': {
      const data = Object.entries(stats?.by_theme || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: capitalize(n), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={65} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
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
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
        <Area type="monotone" dataKey="positive" stroke="#34d399" fill={`url(#${prefix}P)`} strokeWidth={2} />
        <Area type="monotone" dataKey="negative" stroke="#f87171" fill={`url(#${prefix}N)`} strokeWidth={2} />
        <Area type="monotone" dataKey="smoothed" stroke="#8b5cf6" fill="none" strokeWidth={2} strokeDasharray="6 3" name="Moyenne 3j" />
      </AreaChart></ResponsiveContainer></div>;
    }

    case 'sources': {
      const data = Object.entries(stats?.by_source || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: n.replace(/^gnews_|^catalog_|^case_/g, '').replace(/_/g, ' '), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={10}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569' }} width={80} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
    }

    case 'countries': {
      const agg = articles.reduce<Record<string, number>>((acc, a) => { for (const c of a.country_codes) acc[c] = (acc[c] || 0) + 1; return acc; }, {});
      const data = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => ({ name: `${FLAGS[c] || ''} ${c}`, value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={12}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} width={55} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
    }

    case 'conflict': case 'economic': case 'diplomatic': {
      const tm: Record<string, string[]> = { conflict: ['conflict', 'military'], economic: ['economic', 'tech'], diplomatic: ['diplomatic', 'protest'] };
      const pool = articles.filter(a => (tm[id] || []).includes(a.theme));
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          <div className="text-[10px] text-slate-400 font-semibold">{pool.length} articles</div>
          {pool.slice(0, 15).map((a, i) => (
            <a key={a.id || i} href={a.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg border border-transparent hover:border-slate-200 transition-colors">
              <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{a.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {a.country_codes.slice(0, 3).map(c => <span key={c} className="text-[10px]">{FLAGS[c] || c}</span>)}
                <span className="text-[8px] text-slate-400 ml-auto">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
              </div>
            </a>
          ))}
          {pool.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Aucun article</div>}
        </div>
      );
    }

    // ── KPI Analytiques (article-derived, complex) ──────────────

    case 'countrymatrix': {
      const rows = computeCountryMatrix(articles);
      if (!rows.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee pays</div>;
      const barW = (v: number) => `${Math.min(v, 100)}%`;
      const barColor = (v: number) => v > 60 ? '#ef4444' : v > 35 ? '#f97316' : v > 15 ? '#eab308' : '#22c55e';
      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left p-1.5 font-semibold text-slate-500">Pays</th>
                <th className="text-center p-1.5 font-semibold text-slate-500 w-10" title="Nombre d'articles">Art.</th>
                <th className="text-center p-1.5 font-semibold text-slate-500" title="% articles diplomatique/politique">Polit.</th>
                <th className="text-center p-1.5 font-semibold text-slate-500" title="% articles economiques">Eco.</th>
                <th className="text-center p-1.5 font-semibold text-slate-500" title="% articles conflit/militaire/terrorisme">Milit.</th>
                <th className="text-center p-1.5 font-semibold text-slate-500" title="% articles sante/crime/social">Soc.</th>
                <th className="text-center p-1.5 font-semibold text-slate-500" title="Score de menace moyen (0=calme, 100=critique)">Risque</th>
                <th className="text-center p-1.5 font-semibold text-slate-500" title="Evolution du volume 3j recents vs 4j precedents">Evol.</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map(r => (
                <tr key={r.code} className="border-b border-slate-50 border border-transparent hover:border-slate-200">
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
                  <td className="text-center p-1.5">
                    <span className={`text-[9px] font-bold ${r.trend > 0 ? 'text-red-500' : r.trend < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {r.trend > 0 ? `+${r.trend}%` : r.trend < 0 ? `${r.trend}%` : '='}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'countrythemes': {
      const { rows, allThemes } = computeCountryThemeMatrix(articles);
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
              {rows.slice(0, 25).map(r => (
                <tr key={r.code} className="border-b border-slate-50 border border-transparent hover:border-slate-200/50">
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
        </div>
      );
    }

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
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="high" stackId="a" fill="#f97316" /><Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>;
    }

    case 'srccover': {
      const data = computeSourceCoverage(articles);
      if (!data.length) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune source</div>;
      const maxArt = data[0]?.articles || 1;
      return (
        <div className="overflow-y-auto h-full p-2">
          {data.slice(0, 15).map(s => (
            <div key={s.name} className="flex items-center gap-2 py-1">
              <span className="text-[10px] text-slate-700 font-medium w-24 truncate">{s.name}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full bg-[#42d3a5]" style={{ width: `${(s.articles / maxArt) * 100}%` }} /></div>
              <span className="text-[9px] text-slate-500 w-6 text-right">{s.articles}</span>
              <span className="text-[8px] text-slate-400 w-8 text-right">{s.themes}th</span>
            </div>
          ))}
        </div>
      );
    }

    case 'themeradar': {
      const data = computeThemeRadar(articles);
      return <div className="p-2 h-full"><ResponsiveContainer><RadarChart data={data} cx="50%" cy="50%" outerRadius="70%"><PolarGrid stroke="#e2e8f0" /><PolarAngleAxis dataKey="theme" tick={{ fontSize: 9, fill: '#475569' }} /><PolarRadiusAxis tick={{ fontSize: 8 }} /><Radar dataKey="pct" stroke="#42d3a5" fill="#42d3a5" fillOpacity={0.3} strokeWidth={2} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /></RadarChart></ResponsiveContainer></div>;
    }

    default:
      return null;
  }
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
