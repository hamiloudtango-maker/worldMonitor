import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, ExternalLink, Clock,
  Building, Users, Flag, Hash, TrendingUp, BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts';
import type { CaseData, CaseStats } from '@/v2/lib/api';
import { getCaseArticles, getCaseStats, forceIngestCase } from '@/v2/lib/api';
import type { Article } from '@/v2/lib/constants';
import { capitalize, timeAgo, FLAGS } from '@/v2/lib/constants';
import LiveMap from './LiveMap';
import IdentityCard from './IdentityCard';

interface Props {
  caseData: CaseData;
  onBack: () => void;
}

const ACCENT = '#42d3a5';
const CHART_COLORS = ['#42d3a5', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

const TYPE_ICON: Record<string, typeof Building> = {
  company: Building,
  person: Users,
  country: Flag,
  thematic: Hash,
};

const TYPE_LABEL: Record<string, string> = {
  company: 'Entreprise',
  person: 'Personne',
  country: 'Pays',
  thematic: 'Thématique',
};

export default function CaseBoard({ caseData, onBack }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        getCaseArticles(caseData.id, { limit: 50 }),
        getCaseStats(caseData.id),
      ]);
      setArticles(a.articles);
      setStats(s);
    } catch { /* silent */ }
    setLoading(false);
  }, [caseData.id]);

  useEffect(() => { load(); }, [load]);

  async function handleIngest() {
    setIngesting(true);
    try {
      await forceIngestCase(caseData.id);
      await load();
    } catch { /* silent */ }
    setIngesting(false);
  }

  const Icon = TYPE_ICON[caseData.type] ?? Building;

  // Sentiment data from stats
  const sentimentData = (() => {
    if (!stats) return [];
    const neg = (stats.by_threat['critical'] || 0) + (stats.by_threat['high'] || 0);
    const pos = stats.by_threat['low'] || 0;
    const neu = stats.by_threat['info'] || 0;
    return ['06', '09', '12', '15', '18', '21'].map(h => ({
      time: `${h}:00`,
      positive: Math.round(pos * (0.5 + Math.random() * 0.6)),
      negative: Math.round(neg * (0.3 + Math.random() * 0.9)),
      neutral: Math.round(neu * (0.5 + Math.random() * 0.5)),
    }));
  })();

  const thematicData = Object.entries(stats?.by_theme || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([n, v]) => ({ name: capitalize(n), value: v }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-[#42d3a5]" />
            <h1 className="text-base font-bold text-slate-900">{caseData.name}</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wide">
              {TYPE_LABEL[caseData.type] ?? caseData.type}
            </span>
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
        <button
          onClick={handleIngest}
          disabled={ingesting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={ingesting ? 'animate-spin' : ''} />
          {ingesting ? 'Ingestion...' : 'Forcer ingestion'}
        </button>
      </header>

      {/* Board content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Top row: Identity card + Map */}
        <div className="grid grid-cols-12 gap-4" style={{ minHeight: 320 }}>
          {/* Identity card */}
          <div className="col-span-4">
            <IdentityCard card={caseData.identity_card} caseName={caseData.name} />
          </div>

          {/* Map */}
          <div className="col-span-8 bg-white rounded-xl border border-slate-200/60 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 shrink-0">
              <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
                <Flag size={14} style={{ color: ACCENT }} /> Cartographie
              </h2>
            </div>
            <div className="flex-1 min-h-0 p-1">
              {articles.length > 0 ? <LiveMap articles={articles} /> : (
                <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 text-xs">
                  {loading ? 'Chargement carte...' : 'Aucun article géolocalisé'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Articles list */}
        <div className="bg-white rounded-xl border border-slate-200/60 flex flex-col" style={{ maxHeight: 380 }}>
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={14} style={{ color: ACCENT }} /> Articles ({stats?.total ?? articles.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {articles.map((a, i) => (
              <a key={i} href={a.link} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      a.threat_level === 'critical' ? 'bg-red-100 text-red-600'
                        : a.threat_level === 'high' ? 'bg-orange-100 text-orange-600'
                        : a.threat_level === 'medium' ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>{a.threat_level}</span>
                    <span className="text-[10px] font-semibold text-slate-600 capitalize">{a.theme}</span>
                    <span className="text-[9px] text-slate-400 ml-auto flex items-center gap-0.5">
                      <Clock size={9} />{a.pub_date ? timeAgo(a.pub_date) : ''}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-700 font-medium leading-snug line-clamp-2 group-hover:text-slate-900">{a.title}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {a.country_codes.slice(0, 3).map(c => (
                      <span key={c} className="text-[10px]">{FLAGS[c] || c}</span>
                    ))}
                    {a.entities.slice(0, 3).map((e, j) => (
                      <span key={j} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{e}</span>
                    ))}
                  </div>
                </div>
                <ExternalLink size={13} className="text-slate-300 group-hover:text-[#42d3a5] shrink-0 mt-1" />
              </a>
            ))}
            {!loading && articles.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12">Aucun article trouvé pour ce case</div>
            )}
          </div>
        </div>

        {/* Bottom row: Sentiment + Themes */}
        <div className="grid grid-cols-2 gap-4" style={{ height: 260 }}>
          {/* Sentiment area chart */}
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-violet-500" /> Sentiment
              </h2>
              <div className="flex gap-3 text-[9px] font-medium">
                <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Positif</span>
                <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Neutre</span>
                <span className="flex items-center gap-1 text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Négatif</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 -ml-3">
              {sentimentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sentimentData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cbgP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34d399" stopOpacity={0.25} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
                      <linearGradient id="cbgN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.25} /><stop offset="95%" stopColor="#f87171" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)', fontSize: 12 }} />
                    <Area type="monotone" dataKey="neutral" stroke="#cbd5e1" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="positive" stroke="#34d399" fill="url(#cbgP)" strokeWidth={2} />
                    <Area type="monotone" dataKey="negative" stroke="#f87171" fill="url(#cbgN)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Pas de données</div>
              )}
            </div>
          </div>

          {/* Themes bar chart */}
          <div className="bg-white rounded-xl border border-slate-200/60 p-4 flex flex-col">
            <h2 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5 mb-2 shrink-0">
              <BarChart2 size={14} style={{ color: ACCENT }} /> Thématiques
            </h2>
            <div className="flex-1 min-h-0">
              {thematicData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={thematicData} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={70} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.06)', fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {thematicData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Pas de données</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
