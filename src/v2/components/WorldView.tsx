import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Globe, BarChart2, Newspaper, AlertTriangle, TrendingUp,
  Shield, DollarSign, Swords, Radio, Activity, Scale,
  Anchor, Zap, Cloud, FlaskConical, Plane,
  Bitcoin, LineChart, Users, BookOpen, X, ChevronDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { api } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';
import { capitalize, timeAgo, FLAGS } from '@/v2/lib/constants';
import { COUNTRY_NAMES } from '@/v2/lib/sentiment';
import { useGlobalData } from '@/v2/hooks/useData';
import LiveMap from './LiveMap';
import WidgetGrid, { type WidgetDef, type WidgetState } from './WidgetGrid';
import { renderSharedWidget, buildCatalogWithFeeds } from './shared/WidgetCatalog';

const COLORS = ['#42d3a5', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#eab308'];

const CATALOG: WidgetDef[] = [
  // Général
  { id: 'kpis',        title: 'Indicateurs Clés',       icon: Activity,       category: 'Général',       defaultW: 12, defaultH: 2,  minH: 2, minW: 6 },
  { id: 'map',         title: 'Carte Mondiale',          icon: Globe,          category: 'Général',       defaultW: 8,  defaultH: 8,  minH: 4, minW: 4 },
  { id: 'alerts',      title: 'Alertes Critiques',       icon: AlertTriangle,  category: 'Général',       defaultW: 4,  defaultH: 8,  minH: 3, minW: 3 },
  { id: 'news',        title: "Fil d'actualités",        icon: Newspaper,      category: 'Général',       defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
  // Analyse
  { id: 'themes',      title: 'Thématiques',             icon: BarChart2,      category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'sentiment',   title: 'Sentiment Global',        icon: TrendingUp,     category: 'Analyse',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'threats',     title: 'Niveau de Menace',        icon: Shield,         category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'sources',     title: 'Sources Actives',         icon: Radio,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  { id: 'countries',   title: 'Pays actifs',             icon: Globe,          category: 'Analyse',       defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  // Thématique
  { id: 'conflict',    title: 'Conflit & Militaire',     icon: Swords,         category: 'Thématique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'economic',    title: 'Économie & Finance',      icon: DollarSign,     category: 'Thématique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'diplomatic',  title: 'Diplomatie & Politique',   icon: Scale,          category: 'Thématique',    defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  // Sources Live (backend domains)
  { id: 'seismology',  title: 'Séismes',                 icon: Activity,       category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'cyber',       title: 'Menaces Cyber',           icon: Shield,         category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'maritime',    title: 'Alertes Maritimes',       icon: Anchor,         category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'natural',     title: 'Événements Naturels',     icon: Cloud,          category: 'Sources Live',  defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'climate',     title: 'Climat & Anomalies',      icon: Cloud,          category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'radiation',   title: 'Radiation',               icon: Zap,            category: 'Sources Live',  defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'aviation',    title: 'Aviation',                icon: Plane,          category: 'Sources Live',  defaultW: 4,  defaultH: 5,  minH: 3, minW: 3 },
  // Marchés & Économie
  { id: 'crypto',      title: 'Crypto-monnaies',         icon: Bitcoin,        category: 'Marchés',       defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'feargreed',   title: 'Fear & Greed Index',      icon: LineChart,      category: 'Marchés',       defaultW: 4,  defaultH: 4,  minH: 3, minW: 3 },
  { id: 'supplychain', title: 'Supply Chain',            icon: Globe,          category: 'Marchés',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'minerals',    title: 'Minerais Critiques',      icon: FlaskConical,   category: 'Marchés',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  { id: 'fredrates',   title: 'Taux US (FRED)',          icon: LineChart,      category: 'Marchés',       defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
  // Recherche & Veille
  { id: 'predictions', title: 'Marchés Prédictifs',      icon: TrendingUp,     category: 'Veille',        defaultW: 6,  defaultH: 6,  minH: 3, minW: 4 },
  { id: 'hackernews',  title: 'Hacker News',             icon: BookOpen,       category: 'Veille',        defaultW: 4,  defaultH: 6,  minH: 3, minW: 3 },
  { id: 'conflicthum', title: 'Humanitaire (Conflit)',    icon: Users,          category: 'Veille',        defaultW: 6,  defaultH: 5,  minH: 3, minW: 4 },
];

const DEFAULTS: WidgetState[] = [
  { id: 'kpis', w: 12, h: 2 },
  { id: 'map', w: 8, h: 8 },
  { id: 'alerts', w: 4, h: 8 },
  { id: 'themes', w: 4, h: 5 },
  { id: 'sentiment', w: 8, h: 5 },
];


// ── Facet dropdown component ──────────────────────────────────
function FacetDropdown({ label, items, selected, onToggle }: {
  label: string;
  items: { key: string; label: string; count: number; dot?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search ? items.filter(i => i.label.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${
          selected.length > 0 ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        }`}>
        {label}
        {selected.length > 0 && <span className="text-[9px] font-bold opacity-60 ml-0.5">{selected.length}</span>}
        <ChevronDown size={10} className={open ? 'rotate-180' : ''} />
      </button>

      {open && (
        <div className="absolute top-9 left-0 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
          {items.length > 6 && (
            <div className="p-1.5 border-b border-slate-100">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrer..."
                className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#42d3a5]" autoFocus />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.map(item => {
              const active = selected.includes(item.key);
              return (
                <button key={item.key} onClick={() => onToggle(item.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors ${
                    active ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`}>
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                    active ? 'border-[#42d3a5] bg-[#42d3a5]/10' : 'border-slate-300'
                  }`}>{active && <span className="text-[8px] text-[#42d3a5]">&#10003;</span>}</span>
                  {item.dot && <div className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />}
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-[9px] text-slate-400">{item.count}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="py-2 text-center text-[10px] text-slate-400">Aucun resultat</div>}
          </div>
        </div>
      )}
    </div>
  );
}

interface FacetFilters {
  themes: string[];
  threats: string[];
  countries: string[];
}
const EMPTY_FACETS: FacetFilters = { themes: [], threats: [], countries: [] };

export default function WorldView() {
  const { articles, stats, refresh } = useGlobalData();
  const [fullCatalog, setFullCatalog] = useState<WidgetDef[]>(CATALOG);
  const [facets, setFacets] = useState<FacetFilters>(EMPTY_FACETS);

  const hasFilters = facets.themes.length || facets.threats.length || facets.countries.length;

  const filteredArticles = useMemo(() => {
    if (!hasFilters) return articles;
    return articles.filter(a => {
      if (facets.themes.length && !facets.themes.includes(a.theme)) return false;
      if (facets.threats.length && !facets.threats.includes(a.threat_level)) return false;
      if (facets.countries.length && !a.country_codes.some(c => facets.countries.includes(c))) return false;
      return true;
    });
  }, [articles, facets, hasFilters]);

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

  useEffect(() => { buildCatalogWithFeeds().then(setFullCatalog); }, []);

  // Build facet options from stats
  const themeOptions = useMemo(() =>
    Object.entries(stats?.by_theme || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, count: v }))
  , [stats]);
  const threatOptions = [
    { key: 'critical', label: 'Critique', color: 'bg-red-500' },
    { key: 'high', label: 'Eleve', color: 'bg-orange-500' },
    { key: 'medium', label: 'Moyen', color: 'bg-yellow-500' },
    { key: 'low', label: 'Faible', color: 'bg-green-500' },
    { key: 'info', label: 'Info', color: 'bg-slate-400' },
  ];

  const countryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of articles) {
      for (const c of a.country_codes) counts[c] = (counts[c] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: `${FLAGS[k] || ''} ${COUNTRY_NAMES[k] || k}`, count: v }));
  }, [articles]);

  function toggleFacet(facet: keyof FacetFilters, value: string) {
    setFacets(prev => ({
      ...prev,
      [facet]: prev[facet].includes(value) ? prev[facet].filter(v => v !== value) : [...prev[facet], value],
    }));
  }

  return (
    <div className="space-y-3">
      {/* Facet dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        <FacetDropdown label="Pays" items={countryOptions} selected={facets.countries} onToggle={v => toggleFacet('countries', v)} />
        <FacetDropdown label="Thematique" items={themeOptions.map(t => ({ key: t.key, label: capitalize(t.key), count: t.count }))} selected={facets.themes} onToggle={v => toggleFacet('themes', v)} />
        <FacetDropdown label="Menace" items={threatOptions.filter(t => (stats?.by_threat[t.key] || 0) > 0).map(t => ({ key: t.key, label: t.label, count: stats?.by_threat[t.key] || 0, dot: t.color }))} selected={facets.threats} onToggle={v => toggleFacet('threats', v)} />

        {/* Active chips */}
        {facets.countries.map(c => (
          <span key={`c-${c}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {FLAGS[c] || ''} {COUNTRY_NAMES[c] || c}
            <button onClick={() => toggleFacet('countries', c)}><X size={9} /></button>
          </span>
        ))}
        {facets.themes.map(t => (
          <span key={`t-${t}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {capitalize(t)}
            <button onClick={() => toggleFacet('themes', t)}><X size={9} /></button>
          </span>
        ))}
        {facets.threats.map(t => (
          <span key={`th-${t}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-50 text-red-700 border border-red-200">
            {t}
            <button onClick={() => toggleFacet('threats', t)}><X size={9} /></button>
          </span>
        ))}
        {hasFilters ? (
          <button onClick={() => setFacets(EMPTY_FACETS)} className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-0.5">
            <X size={10} /> Effacer
          </button>
        ) : null}
      </div>
      <WidgetGrid
        catalog={fullCatalog}
        storageKey="wm-world-v7"
        defaultWidgets={DEFAULTS}
        renderContent={id => {
          const shared = renderSharedWidget(id, filteredArticles, filteredStats, 'wv');
          if (shared) return shared;
          return <WContent id={id} stats={filteredStats} articles={filteredArticles} onRefresh={refresh} />;
        }}
      />
    </div>
  );
}

/* ═══ Generic list renderer for API data ═══ */
function ApiList({ endpoint, renderItem, emptyMsg = 'Aucune donnée' }: {
  endpoint: string;
  renderItem: (item: any, i: number) => React.ReactNode;
  emptyMsg?: string;
}) {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<any>(endpoint)
      .then(res => {
        // Try to find the array in the response
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
      <div className="text-[9px] text-slate-400 font-semibold mb-1">{data.length} éléments</div>
      {data.slice(0, 30).map((item, i) => renderItem(item, i))}
    </div>
  );
}


/* ═══ Widget content renderer ═══ */
function WContent({ id, stats, articles, onRefresh }: { id: string; stats: Stats | null; articles: Article[]; onRefresh?: () => void }) {
  const alerts = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high');

  switch (id) {
    case 'kpis':
      return (
        <div className="flex gap-2 p-2 h-full items-center">
          {[
            { l: 'Documents', v: stats?.total || 0 }, { l: 'Critiques', v: stats?.by_threat['critical'] || 0 },
            { l: 'Élevées', v: stats?.by_threat['high'] || 0 }, { l: 'Thèmes', v: Object.keys(stats?.by_theme || {}).length },
            { l: 'Sources', v: Object.keys(stats?.by_source || {}).length },
          ].map((k, i) => (
            <div key={i} className="flex-1 bg-slate-50 rounded-lg py-2 px-3 text-center">
              <div className="text-lg font-extrabold text-slate-900">{k.v.toLocaleString()}</div>
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
          {alerts.slice(0, 15).map(a => (
            <a key={a.id} href={a.link} target="_blank" rel="noopener noreferrer" className="block p-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors">
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
          {articles.slice(0, 20).map(a => (
            <a key={a.id} href={a.link} target="_blank" rel="noopener noreferrer" className="block pl-2.5 border-l-2 border-slate-100 hover:border-[#42d3a5] pb-1.5 transition-colors">
              <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">{a.title}</p>
              <span className="text-[8px] font-semibold uppercase text-[#42d3a5]">{a.theme}</span>
              <span className="text-[8px] text-slate-400 ml-2">{a.pub_date ? timeAgo(a.pub_date) : ''}</span>
            </a>
          ))}
        </div>
      );
    case 'themes': {
      const data = Object.entries(stats?.by_theme || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: capitalize(n), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={65} /><Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
    }
    case 'sentiment': {
      const neg = (stats?.by_threat['critical'] || 0) + (stats?.by_threat['high'] || 0);
      const pos = stats?.by_threat['low'] || 0;
      const neu = stats?.by_threat['info'] || 0;
      const data = ['06', '09', '12', '15', '18', '21'].map(h => ({ time: `${h}:00`, positive: Math.round(pos * 0.8), negative: Math.round(neg * 0.6), neutral: Math.round(neu * 0.7) }));
      return <div className="p-2 h-full"><ResponsiveContainer><AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><defs><linearGradient id="wP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.25} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient><linearGradient id="wN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.25} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Area type="monotone" dataKey="positive" stroke="#34d399" fill="url(#wP)" strokeWidth={2} /><Area type="monotone" dataKey="negative" stroke="#f87171" fill="url(#wN)" strokeWidth={2} /><Area type="monotone" dataKey="neutral" stroke="#cbd5e1" fill="none" strokeDasharray="4 4" strokeWidth={1.5} /></AreaChart></ResponsiveContainer></div>;
    }
    case 'threats': {
      const data = Object.entries(stats?.by_threat || {}).map(([n, v]) => ({ name: capitalize(n), value: v }));
      const tc = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#64748b'];
      return <div className="p-2 h-full"><ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%" innerRadius="40%" paddingAngle={3}>{data.map((_, i) => <Cell key={i} fill={tc[i] || '#94a3b8'} />)}</Pie><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /></PieChart></ResponsiveContainer></div>;
    }
    case 'sources': {
      const data = Object.entries(stats?.by_source || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, v]) => ({ name: n.replace(/^gnews_/, '').replace(/_all$/, '').replace(/_/g, ' '), value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={10}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#475569' }} width={80} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>;
    }
    case 'countries': {
      const agg = articles.reduce<Record<string, number>>((acc, a) => { for (const c of a.country_codes) acc[c] = (acc[c] || 0) + 1; return acc; }, {});
      const data = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c, v]) => ({ name: `${FLAGS[c] || ''} ${c}`, value: v }));
      return <div className="p-2 h-full"><ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 5, bottom: 0 }} barSize={12}><XAxis type="number" hide /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} width={55} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
    }
    case 'conflict': case 'economic': case 'diplomatic': {
      const tm: Record<string, string[]> = { conflict: ['conflict', 'military'], economic: ['economic', 'tech'], diplomatic: ['diplomatic', 'protest'] };
      const pool = articles.filter(a => (tm[id] || []).includes(a.theme));
      return (
        <div className="overflow-y-auto h-full p-2 space-y-1.5">
          <div className="text-[10px] text-slate-400 font-semibold">{pool.length} articles</div>
          {pool.slice(0, 15).map((a, i) => (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 transition-all">
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

    /* ═══ LIVE SOURCES — Each calls its own backend endpoint ═══ */

    case 'seismology':
      return <ApiList endpoint="/seismology/v1/list-earthquakes?min_magnitude=4&page_size=20" renderItem={(eq, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 border-l-2" style={{ borderColor: eq.magnitude >= 6 ? '#ef4444' : eq.magnitude >= 5 ? '#f97316' : '#3b82f6' }}>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-800">M{eq.magnitude?.toFixed(1)}</span>
            <span className="text-[9px] text-slate-400">{eq.depth_km ? `${Math.round(eq.depth_km)}km` : ''}</span>
          </div>
          <p className="text-[10px] text-slate-600 line-clamp-1">{eq.place}</p>
        </div>
      )} />;

    case 'cyber':
      return <ApiList endpoint="/cyber/v1/list-cyber-threats?page_size=20" renderItem={(t, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-red-50 text-red-600">{t.malware || t.type}</span>
            <span className="text-[9px] text-slate-400">{t.country}</span>
          </div>
          <p className="text-[10px] text-slate-600 font-mono mt-0.5">{t.ip}{t.port ? `:${t.port}` : ''}</p>
        </div>
      )} />;

    case 'maritime':
      return <ApiList endpoint="/maritime/v1/list-navigational-warnings?page_size=15" renderItem={(w, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 border-l-2 border-blue-300">
          <div className="flex justify-between">
            <span className="text-[9px] font-bold text-blue-600">{w.area}</span>
            <span className="text-[9px] text-slate-400">{w.authority}</span>
          </div>
          <p className="text-[10px] text-slate-600 line-clamp-2 mt-0.5">{w.text}</p>
        </div>
      )} />;

    case 'natural':
      return <ApiList endpoint="/natural/v1/list-natural-events?limit=20" renderItem={(ev, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30">
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-50 text-amber-700">{ev.category_title || ev.category}</span>
            {ev.closed && <span className="text-[8px] text-emerald-500">Fermé</span>}
          </div>
          <p className="text-[10px] text-slate-700 font-medium line-clamp-1 mt-0.5">{ev.title}</p>
        </div>
      )} />;

    case 'climate':
      return <ApiList endpoint="/climate/v1/list-climate-anomalies?page_size=15" renderItem={(a, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-semibold text-slate-800">{a.location}</span>
            <div className="text-[9px] text-slate-400">{a.temperature_c != null ? `${a.temperature_c}°C` : ''} {a.humidity_pct != null ? `${a.humidity_pct}% hum.` : ''}</div>
          </div>
          <span className="text-[9px] text-slate-400">{a.wind_speed_kmh ? `${a.wind_speed_kmh} km/h` : ''}</span>
        </div>
      )} />;

    case 'radiation':
      return <ApiList endpoint="/radiation/v1/list-radiation-observations" renderItem={(r, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-semibold text-slate-800">{r.location_name || 'Station'}</span>
            <div className="text-[9px] text-slate-400">{r.source}</div>
          </div>
          <span className="text-[11px] font-bold text-slate-900">{r.value} {r.unit}</span>
        </div>
      )} />;

    case 'aviation':
      return <ApiList endpoint="/aviation/v1/list-aviation-news?page_size=15" renderItem={(n, i) => (
        <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 transition-all">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{n.title}</p>
        </a>
      )} />;

    case 'crypto':
      return <ApiList endpoint="/market/v1/list-crypto-quotes?per_page=15" renderItem={(c, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 flex justify-between items-center">
          <div>
            <span className="text-[11px] font-bold text-slate-900">{c.symbol || c.name}</span>
            <span className="text-[9px] text-slate-400 ml-1">{c.name}</span>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-slate-900">${typeof c.current_price === 'number' ? c.current_price.toLocaleString() : c.current_price}</div>
            {c.price_change_percentage_24h != null && (
              <div className={`text-[9px] font-bold ${c.price_change_percentage_24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {c.price_change_percentage_24h >= 0 ? '+' : ''}{c.price_change_percentage_24h?.toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      )} />;

    case 'feargreed': {
      return <ApiList endpoint="/market/v1/get-fear-greed-index" renderItem={() => null} emptyMsg="" />;
      // Simple display handled by FearGreedWidget below
    }

    case 'supplychain':
      return <ApiList endpoint="/supply-chain/v1/get-chokepoint-status" renderItem={(cp, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-semibold text-slate-800">{cp.name}</span>
            <div className="text-[9px] text-slate-400">{cp.status} · {cp.active_warnings} alertes</div>
          </div>
          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            cp.disruption_score > 70 ? 'bg-red-50 text-red-600' : cp.disruption_score > 40 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>{cp.disruption_score}/100</div>
        </div>
      )} />;

    case 'minerals':
      return <ApiList endpoint="/supply-chain/v1/get-critical-minerals" renderItem={(m, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-semibold text-slate-800">{m.mineral}</span>
            <div className="text-[9px] text-slate-400">{(m.top_producers || []).slice(0, 2).join(', ')}</div>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
            m.risk_rating === 'high' ? 'bg-red-50 text-red-600' : m.risk_rating === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>{m.risk_rating}</span>
        </div>
      )} />;

    case 'fredrates':
      return <ApiList endpoint="/economic/v1/get-fred-series?series_id=DGS10&limit=15" renderItem={(obs, i) => (
        <div key={i} className="p-1 flex justify-between items-center text-[10px]">
          <span className="text-slate-500">{obs.date}</span>
          <span className="font-bold text-slate-900">{obs.value}%</span>
        </div>
      )} />;

    case 'predictions':
      return <ApiList endpoint="/prediction/v1/list-prediction-markets?page_size=15" renderItem={(m, i) => (
        <div key={i} className="p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2">{m.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${(m.yes_price || 0) * 100}%` }} />
            </div>
            <span className="text-[9px] font-bold text-emerald-600">{Math.round((m.yes_price || 0) * 100)}%</span>
          </div>
        </div>
      )} />;

    case 'hackernews':
      return <ApiList endpoint="/research/v1/list-hackernews-items?page_size=20" renderItem={(item, i) => (
        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 transition-all">
          <p className="text-[10px] text-slate-700 font-medium line-clamp-1">{item.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[9px] text-slate-400">
            <span>{item.score} pts</span>
            <span>{item.comments} comments</span>
            <span>{item.by}</span>
          </div>
        </a>
      )} />;

    case 'conflicthum':
      return <ApiList endpoint="/conflict/v1/get-humanitarian-summary?country_code=UA" renderItem={() => null} emptyMsg="Données humanitaires Ukraine" />;

    case 'rss':
      return <ApiList endpoint="/news/v1/list-feed-digest" renderItem={(item, i) => (
        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30 transition-all">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[9px] font-bold text-[#42d3a5]">{item.source}</span>
          </div>
          <p className="text-[10px] text-slate-700 font-medium line-clamp-1">{item.title}</p>
        </a>
      )} />;

    default:
      return <div className="flex items-center justify-center h-full text-sm text-slate-400">Widget inconnu</div>;
  }
}
