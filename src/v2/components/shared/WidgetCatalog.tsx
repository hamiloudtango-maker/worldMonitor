/**
 * Shared widget catalog + renderers — used by Dashboard, WorldView, and CaseBoard.
 * Single source of truth for all widget definitions and their rendering logic.
 */
import { useState, useEffect } from 'react';
import {
  Globe, BarChart2, Newspaper, AlertTriangle, TrendingUp,
  Shield, DollarSign, Swords, Radio, Activity, Scale,
  Anchor, Zap, Cloud, FlaskConical, Plane,
  Bitcoin, LineChart, Users, BookOpen, Target, Map, Crosshair,
  Flame, Package, Landmark, GraduationCap, Cpu, Coins, BarChart3, CircleDollarSign, Rss
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { api } from '@/v2/lib/api';
import type { Article } from '@/v2/lib/constants';
import { capitalize, timeAgo, FLAGS } from '@/v2/lib/constants';
import {
  computeSentimentByDay, overallSentimentScore, computeCountryMatrix,
  computeTopEntities, computeAlertVelocity, computeSourceCoverage, computeThemeRadar,
  computeCountryThemeMatrix,
} from '@/v2/lib/sentiment';
import LiveMap from '../LiveMap';
import type { WidgetDef } from '../WidgetGrid';

// ── Colors ──────────────────────────────────────────────────────
export const CHART_COLORS = ['#42d3a5', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#eab308'];
const THREAT_PIE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#64748b'];

// ── Full widget catalog (all views) ─────────────────────────────
export const FULL_CATALOG: WidgetDef[] = [
  // Analyse articles
  { id: 'kpis',        title: 'Indicateurs Cles',       icon: Activity,       category: 'General',       defaultW: 12, defaultH: 2,  minH: 2, minW: 6 },
  { id: 'map',         title: 'Carte Mondiale',          icon: Globe,          category: 'General',       defaultW: 8,  defaultH: 8,  minH: 4, minW: 4 },
  { id: 'alerts',      title: 'Alertes Critiques',       icon: AlertTriangle,  category: 'General',       defaultW: 4,  defaultH: 8,  minH: 3, minW: 3 },
  { id: 'news',        title: "Fil d'actualites",        icon: Newspaper,      category: 'General',       defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
  { id: 'themes',      title: 'Thematiques',             icon: BarChart2,      category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'sentiment',   title: 'Sentiment Global',        icon: TrendingUp,     category: 'Analyse',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'threats',     title: 'Niveau de Menace',        icon: Shield,         category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'sources',     title: 'Sources Actives',         icon: Radio,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'countries',   title: 'Pays actifs',             icon: Globe,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  // Thematique
  { id: 'conflict',    title: 'Conflit & Militaire',     icon: Swords,         category: 'Thematique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'economic',    title: 'Economie & Finance',      icon: DollarSign,     category: 'Thematique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'diplomatic',  title: 'Diplomatie & Politique',   icon: Scale,          category: 'Thematique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  // Sources Live
  { id: 'seismology',  title: 'Seismes',                 icon: Activity,       category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'cyber',       title: 'Menaces Cyber',           icon: Shield,         category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'maritime',    title: 'Alertes Maritimes',       icon: Anchor,         category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'natural',     title: 'Evenements Naturels',     icon: Cloud,          category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'climate',     title: 'Climat & Anomalies',      icon: Cloud,          category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'radiation',   title: 'Radiation',               icon: Zap,            category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'aviation',    title: 'Aviation',                icon: Plane,          category: 'Sources Live',  defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'fires',       title: 'Incendies (NASA)',        icon: Flame,          category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'displacement',title: 'Deplacements Forces',     icon: Users,          category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'worldbank',   title: 'Banque Mondiale',         icon: Landmark,       category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'comtrade',    title: 'Commerce (UN)',            icon: Package,        category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  // Marches
  { id: 'crypto',      title: 'Crypto-monnaies',         icon: Bitcoin,        category: 'Marches',       defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'feargreed',   title: 'Fear & Greed Index',      icon: LineChart,      category: 'Marches',       defaultW: 4,  defaultH: 4,  minH: 3, minW: 3 },
  { id: 'supplychain', title: 'Supply Chain',            icon: Globe,          category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'minerals',    title: 'Minerais Critiques',      icon: FlaskConical,   category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'fredrates',   title: 'Taux US (FRED)',          icon: LineChart,      category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'commodities', title: 'Matieres Premieres',      icon: Package,        category: 'Marches',       defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'stablecoins', title: 'Stablecoins',             icon: Coins,          category: 'Marches',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'etfflows',    title: 'Flux ETF',                icon: BarChart3,      category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'stockindex',  title: 'Indices Boursiers',       icon: Landmark,       category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'gulfquotes',  title: 'Marches du Golfe',        icon: CircleDollarSign, category: 'Marches',     defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'sectors',     title: 'Resume Sectoriel',        icon: BarChart2,      category: 'Marches',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'cryptosectors', title: 'Secteurs Crypto',       icon: Bitcoin,        category: 'Marches',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'defi',        title: 'DeFi Tokens',             icon: Coins,          category: 'Marches',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'aitokens',    title: 'Tokens IA',               icon: Cpu,            category: 'Marches',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  // KPIs Analytiques
  { id: 'countrymatrix', title: 'Stabilite Pays',        icon: Map,            category: 'KPI',           defaultW: 12, defaultH: 8,  minH: 5, minW: 6 },
  { id: 'countrythemes', title: 'Pays x Themes',         icon: Globe,          category: 'KPI',           defaultW: 12, defaultH: 8,  minH: 5, minW: 6 },
  { id: 'topentities',   title: 'Top Entites',           icon: Target,         category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'velocity',      title: 'Velocite Alertes',      icon: Crosshair,      category: 'KPI',           defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'srccover',      title: 'Couverture Sources',    icon: Radio,          category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  { id: 'themeradar',    title: 'Radar Thematique',      icon: Activity,       category: 'KPI',           defaultW: 6,  defaultH: 6,  minH: 4, minW: 4 },
  // Veille
  { id: 'predictions', title: 'Marches Predictifs',      icon: TrendingUp,     category: 'Veille',        defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'hackernews',  title: 'Hacker News',             icon: BookOpen,       category: 'Veille',        defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
  { id: 'arxiv',       title: 'ArXiv Papers',            icon: GraduationCap,  category: 'Veille',        defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'conflicthum', title: 'Humanitaire (Conflit)',    icon: Users,          category: 'Veille',        defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  // AI Feeds (dynamic — placeholder, real feeds are loaded from API)
  { id: 'ai-feed-placeholder', title: 'AI Feed', icon: Rss, category: 'AI Feeds', defaultW: 4, defaultH: 6, minH: 3, minW: 3 },
];

// ── Generic list renderer for API data ──────────────────────────
export function ApiList({ endpoint, renderItem, emptyMsg = 'Aucune donnee' }: {
  endpoint: string;
  renderItem: (item: any, i: number) => React.ReactNode;
  emptyMsg?: string;
}) {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<any>(endpoint)
      .then(res => {
        if (Array.isArray(res)) { setData(res); return; }
        for (const key of Object.keys(res)) {
          if (Array.isArray(res[key])) { setData(res[key]); return; }
        }
        setData([]);
      })
      .catch(() => setError(true));
  }, [endpoint]);

  if (error) return <div className="flex items-center justify-center h-full text-xs text-red-400">Erreur de chargement</div>;
  if (!data) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Chargement...</div>;
  if (data.length === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-400">{emptyMsg}</div>;

  return (
    <div className="overflow-y-auto h-full p-2 space-y-1">
      <div className="text-[9px] text-slate-400 font-semibold mb-1">{data.length} elements</div>
      {data.slice(0, 30).map((item, i) => renderItem(item, i))}
    </div>
  );
}

// ── Shared widget renderer ──────────────────────────────────────
// Renders any widget given articles + stats. Works for Dashboard, WorldView, CaseBoard.
// prefix: unique ID prefix for SVG gradients to avoid collisions
export function renderSharedWidget(
  id: string,
  articles: Article[],
  stats: { total: number; by_theme: Record<string, number>; by_threat: Record<string, number>; by_source: Record<string, number> } | null,
  prefix: string = 'sw',
  _extra?: { cases?: any[]; onRefresh?: () => void },
): React.ReactNode {
  const alerts = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high');

  // AI Feed widgets
  if (id.startsWith('ai-feed-') && id !== 'ai-feed-placeholder') {
    const feedId = id.replace('ai-feed-', '');
    return <AIFeedWidget feedId={feedId} />;
  }

  switch (id) {

    // ── Article-based widgets ────────────────────────────────────

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
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors">
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
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="block pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
              <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
              <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.theme}</span>
              <span className="text-[8px] text-slate-400 ml-2">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
            </a>
          ))}
        </div>
      );

    case 'themes': {
      const data = Object.entries(stats?.by_theme || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: capitalize(n), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={65} /><Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
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
        <Area type="monotone" dataKey="neutral" stroke="#cbd5e1" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
        <Area type="monotone" dataKey="smoothed" stroke="#8b5cf6" fill="none" strokeWidth={2} strokeDasharray="6 3" name="Moyenne 3j" />
      </AreaChart></ResponsiveContainer></div>;
    }

    case 'threats': {
      const data = Object.entries(stats?.by_threat || {}).map(([n, v]) => ({ name: capitalize(n), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" innerRadius="40%" paddingAngle={3}>{data.map((_, i) => <Cell key={i} fill={THREAT_PIE[i] || '#94a3b8'} />)}</Pie><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /></PieChart></ResponsiveContainer></div>;
    }

    case 'sources': {
      const data = Object.entries(stats?.by_source || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: n.replace(/^gnews_|^catalog_|^case_/g, '').replace(/_all$/, '').replace(/_/g, ' '), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={10}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569' }} width={80} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
    }

    case 'countries': {
      const agg = articles.reduce<Record<string, number>>((acc, a) => { for (const c of a.country_codes) acc[c] = (acc[c] || 0) + 1; return acc; }, {});
      const data = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => ({ name: `${FLAGS[c] || ''} ${c}`, value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={12}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} width={55} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
    }

    // ── Thematic article filters ─────────────────────────────────

    case 'conflict': case 'economic': case 'diplomatic': {
      const tm: Record<string, string[]> = { conflict: ['conflict', 'military'], economic: ['economic', 'tech'], diplomatic: ['diplomatic', 'protest'] };
      const pool = articles.filter(a => (tm[id] || []).includes(a.theme));
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          <div className="text-[10px] text-slate-400 font-semibold">{pool.length} articles</div>
          {pool.slice(0, 15).map((a, i) => (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
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

    // ── Live API sources ─────────────────────────────────────────

    case 'seismology':
      return <ApiList endpoint="/seismology/v1/list-earthquakes?min_magnitude=4&page_size=20" renderItem={(eq, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 border-l-2" style={{ borderColor: eq.magnitude >= 6 ? '#ef4444' : eq.magnitude >= 5 ? '#f97316' : '#3b82f6' }}>
          <div className="flex justify-between items-center"><span className="text-[11px] font-bold text-slate-800">M{eq.magnitude?.toFixed(1)}</span><span className="text-[9px] text-slate-400">{eq.depth_km ? `${Math.round(eq.depth_km)}km` : ''}</span></div>
          <p className="text-[10px] text-slate-600 line-clamp-1">{eq.place}</p>
        </div>
      )} />;

    case 'cyber':
      return <ApiList endpoint="/cyber/v1/list-cyber-threats?page_size=20" renderItem={(t, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50">
          <div className="flex justify-between items-center"><span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-red-50 text-red-600">{t.malware || t.type}</span><span className="text-[9px] text-slate-400">{t.country}</span></div>
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">{t.ip}{t.port ? `:${t.port}` : ''}</p>
        </div>
      )} />;

    case 'maritime':
      return <ApiList endpoint="/maritime/v1/list-navigational-warnings?page_size=15" renderItem={(w, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 border-l-2 border-blue-300">
          <div className="flex justify-between"><span className="text-[9px] font-bold text-blue-600">{w.area}</span><span className="text-[9px] text-slate-400">{w.authority}</span></div>
          <p className="text-[10px] text-slate-600 line-clamp-2 mt-0.5">{w.text}</p>
        </div>
      )} />;

    case 'natural':
      return <ApiList endpoint="/natural/v1/list-natural-events?limit=20" renderItem={(ev, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50">
          <div className="flex justify-between items-center"><span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700">{ev.category_title || ev.category}</span>{ev.closed && <span className="text-[8px] text-emerald-500">Ferme</span>}</div>
          <p className="text-[10px] text-slate-700 font-medium line-clamp-1 mt-0.5">{ev.title}</p>
        </div>
      )} />;

    case 'climate':
      return <ApiList endpoint="/climate/v1/list-climate-anomalies?page_size=15" renderItem={(a, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-semibold text-slate-800">{a.location}</span><div className="text-[9px] text-slate-400">{a.temperature_c != null ? `${a.temperature_c} C` : ''} {a.humidity_pct != null ? `${a.humidity_pct}% hum.` : ''}</div></div>
          <span className="text-[9px] text-slate-400">{a.wind_speed_kmh ? `${a.wind_speed_kmh} km/h` : ''}</span>
        </div>
      )} />;

    case 'radiation':
      return <ApiList endpoint="/radiation/v1/list-radiation-observations" renderItem={(r, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-semibold text-slate-800">{r.location_name || 'Station'}</span><div className="text-[9px] text-slate-400">{r.source}</div></div>
          <span className="text-[11px] font-bold text-slate-900">{r.value} {r.unit}</span>
        </div>
      )} />;

    case 'aviation':
      return <ApiList endpoint="/aviation/v1/list-aviation-news?page_size=15" renderItem={(n, i) => (
        <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{n.title}</p>
        </a>
      )} />;

    case 'fires':
      return <ApiList endpoint="/natural/v1/list-fire-detections?limit=20" renderItem={(f, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 border-l-2 border-orange-400">
          <div className="flex justify-between items-center"><span className="text-[10px] font-semibold text-slate-800">{f.country || f.location || `${f.latitude?.toFixed(2)}, ${f.longitude?.toFixed(2)}`}</span><span className="text-[9px] font-bold text-orange-600">{f.brightness ? `${f.brightness.toFixed(0)}K` : ''}</span></div>
          <div className="text-[9px] text-slate-400">{f.satellite || f.source} {f.acq_date || f.detected_at || ''}</div>
        </div>
      )} />;

    case 'displacement':
      return <ApiList endpoint="/conflict/v1/get-displacement-summary" renderItem={(d, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-semibold text-slate-800">{d.country || d.region}</span><div className="text-[9px] text-slate-400">{d.cause || d.type || ''}</div></div>
          <span className="text-[10px] font-bold text-slate-900">{typeof d.count === 'number' ? d.count.toLocaleString() : d.figure || d.count}</span>
        </div>
      )} />;

    case 'worldbank':
      return <ApiList endpoint="/economic/v1/list-world-bank-indicators?indicator=NY.GDP.MKTP.KD.ZG&limit=15" renderItem={(ind, i) => (
        <div key={i} className="p-1 flex justify-between items-center text-[10px]">
          <span className="text-slate-700 font-medium">{ind.country || ind.countryiso3code}</span>
          <span className="font-bold text-slate-900">{typeof ind.value === 'number' ? ind.value.toFixed(2) : ind.value}%</span>
        </div>
      )} />;

    case 'comtrade':
      return <ApiList endpoint="/supply-chain/v1/list-comtrade-flows?reporter=USA&limit=15" renderItem={(f, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-semibold text-slate-800">{f.partner || f.partner_desc}</span><div className="text-[9px] text-slate-400">{f.commodity_desc || f.commodity || ''}</div></div>
          <span className="text-[10px] font-bold text-slate-900">{f.trade_value != null ? `$${(f.trade_value / 1e6).toFixed(1)}M` : ''}</span>
        </div>
      )} />;

    // ── Markets ──────────────────────────────────────────────────

    case 'crypto':
      return <ApiList endpoint="/market/v1/list-crypto-quotes?per_page=15" renderItem={(c, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[11px] font-bold text-slate-900">{c.symbol || c.name}</span><span className="text-[9px] text-slate-400 ml-1">{c.name}</span></div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">${typeof c.current_price === 'number' ? c.current_price.toLocaleString() : c.current_price}</div>
            {c.price_change_percentage_24h != null && <div className={`text-[9px] font-bold ${c.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{c.price_change_percentage_24h >= 0 ? '+' : ''}{c.price_change_percentage_24h?.toFixed(1)}%</div>}
          </div>
        </div>
      )} />;

    case 'feargreed':
      return <ApiList endpoint="/market/v1/get-fear-greed-index" renderItem={() => null} emptyMsg="" />;

    case 'supplychain':
      return <ApiList endpoint="/supply-chain/v1/get-chokepoint-status" renderItem={(cp, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-semibold text-slate-800">{cp.name}</span><div className="text-[9px] text-slate-400">{cp.status} {cp.active_warnings} alertes</div></div>
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cp.disruption_score > 70 ? 'bg-red-50 text-red-600' : cp.disruption_score > 40 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{cp.disruption_score}/100</div>
        </div>
      )} />;

    case 'minerals':
      return <ApiList endpoint="/supply-chain/v1/get-critical-minerals" renderItem={(m, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-semibold text-slate-800">{m.mineral}</span><div className="text-[9px] text-slate-400">{(m.top_producers || []).slice(0, 2).join(', ')}</div></div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.risk_rating === 'high' ? 'bg-red-50 text-red-600' : m.risk_rating === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{m.risk_rating}</span>
        </div>
      )} />;

    case 'fredrates':
      return <ApiList endpoint="/economic/v1/get-fred-series?series_id=DGS10&limit=15" renderItem={(obs, i) => (
        <div key={i} className="p-1 flex justify-between items-center text-[10px]"><span className="text-slate-500">{obs.date}</span><span className="font-bold text-slate-900">{obs.value}%</span></div>
      )} />;

    case 'commodities':
      return <ApiList endpoint="/market/v1/list-commodity-quotes?per_page=15" renderItem={(c, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <span className="text-[10px] font-semibold text-slate-800">{c.name || c.symbol}</span>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">${typeof c.price === 'number' ? c.price.toLocaleString() : c.current_price?.toLocaleString() || c.price}</div>
            {(c.change_pct ?? c.price_change_percentage_24h) != null && <div className={`text-[9px] font-bold ${(c.change_pct ?? c.price_change_percentage_24h) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{(c.change_pct ?? c.price_change_percentage_24h) >= 0 ? '+' : ''}{(c.change_pct ?? c.price_change_percentage_24h)?.toFixed(2)}%</div>}
          </div>
        </div>
      )} />;

    case 'stablecoins':
      return <ApiList endpoint="/market/v1/list-stablecoin-markets?per_page=15" renderItem={(s, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-bold text-slate-900">{s.symbol || s.name}</span><span className="text-[9px] text-slate-400 ml-1">{s.name}</span></div>
          <div className="text-[11px] font-bold text-slate-900">${typeof s.current_price === 'number' ? s.current_price.toFixed(4) : s.current_price}</div>
        </div>
      )} />;

    case 'etfflows':
      return <ApiList endpoint="/market/v1/list-etf-flows?per_page=15" renderItem={(e, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-bold text-slate-900">{e.ticker || e.name}</span><span className="text-[9px] text-slate-400 ml-1">{e.name}</span></div>
          <div className="text-[11px] font-bold text-slate-900">{e.flow != null ? `$${(e.flow / 1e6).toFixed(1)}M` : e.aum ? `$${(e.aum / 1e9).toFixed(1)}B` : ''}</div>
        </div>
      )} />;

    case 'stockindex':
      return <ApiList endpoint="/market/v1/get-country-stock-index?country=US" renderItem={(s, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <span className="text-[10px] font-semibold text-slate-800">{s.name || s.index}</span>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value || s.price}</div>
            {s.change_pct != null && <div className={`text-[9px] font-bold ${s.change_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(2)}%</div>}
          </div>
        </div>
      )} />;

    case 'gulfquotes':
      return <ApiList endpoint="/market/v1/list-gulf-quotes?per_page=15" renderItem={(q, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <span className="text-[10px] font-semibold text-slate-800">{q.symbol || q.name}</span>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">{q.price || q.current_price}</div>
            {(q.change_pct ?? q.price_change_percentage_24h) != null && <div className={`text-[9px] font-bold ${(q.change_pct ?? q.price_change_percentage_24h) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{(q.change_pct ?? q.price_change_percentage_24h) >= 0 ? '+' : ''}{(q.change_pct ?? q.price_change_percentage_24h)?.toFixed(2)}%</div>}
          </div>
        </div>
      )} />;

    case 'sectors':
      return <ApiList endpoint="/market/v1/get-sector-summary" renderItem={(s, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <span className="text-[10px] font-semibold text-slate-800">{s.sector || s.name}</span>
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(s.change_pct ?? s.performance) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{(s.change_pct ?? s.performance) >= 0 ? '+' : ''}{(s.change_pct ?? s.performance)?.toFixed(2)}%</div>
        </div>
      )} />;

    case 'cryptosectors':
      return <ApiList endpoint="/market/v1/list-crypto-sectors?per_page=15" renderItem={(s, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <span className="text-[10px] font-semibold text-slate-800">{s.name}</span>
          <div className="text-right">
            <div className="text-[10px] text-slate-500">MCap: ${s.market_cap ? (s.market_cap / 1e9).toFixed(1) + 'B' : '--'}</div>
            {s.change_24h != null && <div className={`text-[9px] font-bold ${s.change_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.change_24h >= 0 ? '+' : ''}{s.change_24h?.toFixed(1)}%</div>}
          </div>
        </div>
      )} />;

    case 'defi':
      return <ApiList endpoint="/market/v1/list-defi-tokens?per_page=15" renderItem={(t, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-bold text-slate-900">{t.symbol}</span><span className="text-[9px] text-slate-400 ml-1">{t.name}</span></div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">${typeof t.current_price === 'number' ? t.current_price.toLocaleString() : t.current_price}</div>
            {t.price_change_percentage_24h != null && <div className={`text-[9px] font-bold ${t.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{t.price_change_percentage_24h >= 0 ? '+' : ''}{t.price_change_percentage_24h?.toFixed(1)}%</div>}
          </div>
        </div>
      )} />;

    case 'aitokens':
      return <ApiList endpoint="/market/v1/list-ai-tokens?per_page=15" renderItem={(t, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50 flex justify-between items-center">
          <div><span className="text-[10px] font-bold text-slate-900">{t.symbol}</span><span className="text-[9px] text-slate-400 ml-1">{t.name}</span></div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">${typeof t.current_price === 'number' ? t.current_price.toLocaleString() : t.current_price}</div>
            {t.price_change_percentage_24h != null && <div className={`text-[9px] font-bold ${t.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{t.price_change_percentage_24h >= 0 ? '+' : ''}{t.price_change_percentage_24h?.toFixed(1)}%</div>}
          </div>
        </div>
      )} />;

    // ── Research ─────────────────────────────────────────────────

    case 'predictions':
      return <ApiList endpoint="/prediction/v1/list-prediction-markets?page_size=15" renderItem={(m, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:bg-slate-50">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{m.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(m.yes_price || 0) * 100}%` }} /></div>
            <span className="text-[9px] font-bold text-emerald-600">{Math.round((m.yes_price || 0) * 100)}%</span>
          </div>
        </div>
      )} />;

    case 'hackernews':
      return <ApiList endpoint="/research/v1/list-hackernews-items?page_size=20" renderItem={(item, i) => (
        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-1">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400"><span>{item.score} pts</span><span>{item.comments} comments</span><span>{item.by}</span></div>
        </a>
      )} />;

    case 'arxiv':
      return <ApiList endpoint="/research/v1/list-arxiv-papers?query=artificial+intelligence&max_results=15" renderItem={(p, i) => (
        <a key={i} href={p.link || p.id} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{p.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400"><span>{(p.authors || []).slice(0, 2).join(', ')}</span><span className="ml-auto">{p.published || ''}</span></div>
        </a>
      )} />;

    case 'conflicthum':
      return <ApiList endpoint="/conflict/v1/get-humanitarian-summary?country_code=UA" renderItem={() => null} emptyMsg="Donnees humanitaires Ukraine" />;

    // ── KPI Analytiques ─────────────────────────────────────────

    case 'countrymatrix': {
      const rows = computeCountryMatrix(articles);
      if (rows.length === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee pays</div>;
      const barW = (v: number) => `${Math.min(v, 100)}%`;
      const barColor = (v: number) => v > 60 ? '#ef4444' : v > 35 ? '#f97316' : v > 15 ? '#eab308' : '#22c55e';
      return (
        <div className="overflow-auto h-full">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left p-1.5 font-semibold text-slate-500">Pays</th>
                <th className="text-center p-1.5 font-semibold text-slate-500 w-10">Art.</th>
                <th className="text-center p-1.5 font-semibold text-slate-500">Politique</th>
                <th className="text-center p-1.5 font-semibold text-slate-500">Economie</th>
                <th className="text-center p-1.5 font-semibold text-slate-500">Militaire</th>
                <th className="text-center p-1.5 font-semibold text-slate-500">Social</th>
                <th className="text-center p-1.5 font-semibold text-slate-500">Risque</th>
                <th className="text-center p-1.5 font-semibold text-slate-500">Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
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
      if (rows.length === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee</div>;
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
              {rows.slice(0, 25).map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
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
      if (rows.length === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune entite</div>;
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1">
          {rows.slice(0, 20).map((e, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50">
              <span className="text-[11px] font-bold text-slate-800 flex-1 truncate">{e.name}</span>
              <div className="flex gap-1">
                {e.themes.map(t => <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-slate-100 text-slate-500">{t}</span>)}
              </div>
              <span className="text-[10px] font-bold text-slate-600 w-6 text-right">{e.count}</span>
              <span className={`text-[9px] font-bold w-10 text-right ${e.trend > 0 ? 'text-red-500' : e.trend < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                {e.trend > 0 ? `+${e.trend}%` : e.trend < 0 ? `${e.trend}%` : '='}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case 'velocity': {
      const data = computeAlertVelocity(articles);
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
        <Bar dataKey="high" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
        <Bar dataKey="critical" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart></ResponsiveContainer></div>;
    }

    case 'srccover': {
      const data = computeSourceCoverage(articles);
      if (data.length === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune source</div>;
      const maxArt = data[0]?.articles || 1;
      return (
        <div className="overflow-y-auto h-full p-2">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className="text-left p-1 font-semibold text-slate-500">Source</th>
                <th className="text-right p-1 font-semibold text-slate-500 w-14">Articles</th>
                <th className="p-1 font-semibold text-slate-500 w-24">Volume</th>
                <th className="text-right p-1 font-semibold text-slate-500 w-12">Themes</th>
                <th className="text-right p-1 font-semibold text-slate-500 w-10">Pays</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="p-1 font-medium text-slate-700 truncate max-w-[120px]">{s.name}</td>
                  <td className="text-right p-1 font-bold text-slate-800">{s.articles}</td>
                  <td className="p-1"><div className="bg-slate-100 rounded-full h-1.5 w-full"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(s.articles / maxArt) * 100}%` }} /></div></td>
                  <td className="text-right p-1 text-slate-600">{s.themes}</td>
                  <td className="text-right p-1 text-slate-600">{s.countries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'themeradar': {
      const data = computeThemeRadar(articles).slice(0, 8);
      if (data.length === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Aucune donnee</div>;
      return <div className="p-2 h-full"><ResponsiveContainer><RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="theme" tick={{ fontSize: 9, fill: '#475569' }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Radar name="Articles" dataKey="pct" stroke="#42d3a5" fill="#42d3a5" fillOpacity={0.3} strokeWidth={2} />
        <Radar name="Menace" dataKey="avgThreat" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={1.5} />
        <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
      </RadarChart></ResponsiveContainer></div>;
    }

    default:
      return null; // let caller handle (e.g. RSS widgets)
  }
}

function AIFeedWidget({ feedId }: { feedId: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('@/v2/lib/ai-feeds-api').then(({ listFeedArticles }) => {
      listFeedArticles(feedId, { limit: 15 })
        .then(d => { setArticles(d.articles); setLoading(false); })
        .catch(() => setLoading(false));
    });
  }, [feedId]);

  if (loading) return <div className="flex items-center justify-center h-full text-xs text-slate-400">Chargement...</div>;

  return (
    <div className="overflow-y-auto h-full p-2 space-y-1.5">
      {articles.map((a: any, i: number) => (
        <a key={i} href={a.article_url} target="_blank" rel="noopener noreferrer"
           className="block pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
          <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.source_name}</span>
            {a.relevance_score > 0 && <span className="text-[8px] text-blue-500 font-bold">{Math.round(a.relevance_score)}%</span>}
            <span className="text-[8px] text-slate-400">{a.published_at ? timeAgo(a.published_at) : ''}</span>
          </div>
        </a>
      ))}
      {articles.length === 0 && <div className="text-center text-xs text-slate-400 py-6">Pas d'articles</div>}
    </div>
  );
}
