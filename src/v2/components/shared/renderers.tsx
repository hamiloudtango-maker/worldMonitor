/**
 * Generic widget renderers — 6 types cover 36+ widgets.
 * Each renderer takes data + field mapping config and renders autonomously.
 */
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { api } from '@/v2/lib/api';
import { timeAgo, FLAGS } from '@/v2/lib/constants';

export const CHART_COLORS = ['#42d3a5', '#3b82f6', '#f97316', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#eab308'];

// ── Shared data fetcher hook ───────────────────────────────────

function useApiData(endpoint: string) {
  const [data, setData] = useState<any[] | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api<any>(endpoint)
      .then(res => {
        setRaw(res);
        if (Array.isArray(res)) { setData(res); return; }
        for (const key of Object.keys(res)) {
          if (Array.isArray(res[key])) { setData(res[key]); return; }
        }
        setData([]);
      })
      .catch(() => setError(true));
  }, [endpoint]);

  return { data, raw, error };
}

function Loading() { return <div className="flex items-center justify-center h-full text-xs text-slate-400">Chargement...</div>; }
function Error() { return <div className="flex items-center justify-center h-full text-xs text-red-400">Erreur de chargement</div>; }
function Empty({ msg = 'Aucune donnee' }: { msg?: string }) { return <div className="flex items-center justify-center h-full text-xs text-slate-400">{msg}</div>; }

// ── Helper: get nested value ───────────────────────────────────

function get(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function fmt(v: any, format?: string): string {
  if (v == null) return '';
  if (format === 'price') return `$${typeof v === 'number' ? v.toLocaleString() : v}`;
  if (format === 'pct') return `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`;
  if (format === 'int') return typeof v === 'number' ? v.toLocaleString() : String(v);
  if (format === 'flag') return FLAGS[v] || v;
  if (format === 'time') return timeAgo(v);
  return String(v);
}

// ═══════════════════════════════════════════════════════════════
// 1. LIST RENDERER
// Covers: price-list, status-list, article-list (30+ widgets)
// ═══════════════════════════════════════════════════════════════

export interface ListField {
  key: string;         // dot path into item
  format?: string;     // 'price' | 'pct' | 'int' | 'flag' | 'time' | undefined
  position: 'title' | 'subtitle' | 'value' | 'change' | 'badge' | 'flag';
  badgeColors?: Record<string, string>; // value → tailwind color class
}

export interface ListConfig {
  endpoint: string;
  fields: ListField[];
  linkField?: string;  // if set, items are clickable <a> tags
  maxItems?: number;
  borderColorField?: string; // left border color based on a field
}

export function ListRenderer({ config }: { config: ListConfig }) {
  const { data, error } = useApiData(config.endpoint);
  if (error) return <Error />;
  if (!data) return <Loading />;
  if (!data.length) return <Empty />;

  const items = data.slice(0, config.maxItems || 25);

  return (
    <div className="overflow-y-auto h-full p-2 space-y-1">
      <div className="text-[9px] text-slate-400 font-semibold mb-1">{data.length} elements</div>
      {items.map((item, i) => {
        const title = config.fields.find(f => f.position === 'title');
        const subtitle = config.fields.find(f => f.position === 'subtitle');
        const value = config.fields.find(f => f.position === 'value');
        const change = config.fields.find(f => f.position === 'change');
        const badge = config.fields.find(f => f.position === 'badge');
        const flag = config.fields.find(f => f.position === 'flag');
        const changeVal = change ? Number(get(item, change.key)) : null;
        const link = config.linkField ? get(item, config.linkField) : null;

        const content = (
          <div className="p-1.5 rounded-lg border border-transparent hover:border-slate-200 flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {flag && <span className="text-[11px] shrink-0">{fmt(get(item, flag.key), 'flag')}</span>}
              {badge && (() => {
                const bv = get(item, badge.key);
                const colors = badge.badgeColors || {};
                const cls = colors[bv] || 'bg-slate-100 text-slate-500';
                return <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded shrink-0 ${cls}`}>{bv}</span>;
              })()}
              <div className="min-w-0">
                {title && <span className="text-[10px] font-semibold text-slate-800 block truncate">{fmt(get(item, title.key), title.format)}</span>}
                {subtitle && <span className="text-[9px] text-slate-400 block truncate">{fmt(get(item, subtitle.key), subtitle.format)}</span>}
              </div>
            </div>
            <div className="text-right shrink-0">
              {value && <div className="text-[11px] font-bold text-slate-900">{fmt(get(item, value.key), value.format)}</div>}
              {changeVal != null && !isNaN(changeVal) && (
                <div className={`text-[9px] font-bold ${changeVal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {fmt(changeVal, 'pct')}
                </div>
              )}
            </div>
          </div>
        );

        return link
          ? <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block transition-colors">{content}</a>
          : <div key={i}>{content}</div>;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. CHART RENDERER
// Covers: area-chart, bar-chart
// ═══════════════════════════════════════════════════════════════

export interface ChartSeries {
  key: string;
  color: string;
  label?: string;
  stack?: string;  // for stacked areas/bars
}

export interface ChartConfig {
  endpoint?: string;        // API source (omit if data is passed)
  dataKey?: string;         // key in API response containing the array
  xField: string;           // x-axis field
  xFormat?: (v: string) => string; // transform x labels
  series: ChartSeries[];
  type: 'area' | 'bar' | 'bar-horizontal' | 'radar';
  showLabel?: string;       // top-left label with current value
}

export function ChartRenderer({ config, data: passedData }: { config: ChartConfig; data?: any[] }) {
  const [fetched, setFetched] = useState<any[] | null>(passedData || null);
  const [loading, setLoading] = useState(!passedData);

  useEffect(() => {
    if (passedData) { setFetched(passedData); setLoading(false); return; }
    if (!config.endpoint) { setLoading(false); return; }
    api<any>(config.endpoint)
      .then(res => {
        const arr = config.dataKey ? res[config.dataKey] : (Array.isArray(res) ? res : []);
        setFetched(arr);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [config.endpoint, passedData]);

  if (loading) return <Loading />;
  if (!fetched?.length) return <Empty />;

  const data = fetched.map(d => {
    const row: any = { x: config.xFormat ? config.xFormat(String(get(d, config.xField))) : String(get(d, config.xField)) };
    for (const s of config.series) row[s.label || s.key] = Number(get(d, s.key)) || 0;
    return row;
  });

  if (config.type === 'radar') {
    return (
      <div className="p-2 h-full">
        <ResponsiveContainer>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="x" tick={{ fontSize: 9, fill: '#475569' }} />
            <PolarRadiusAxis tick={{ fontSize: 8 }} />
            {config.series.map((s, i) => (
              <Radar key={i} dataKey={s.label || s.key} stroke={s.color} fill={s.color} fillOpacity={0.3} strokeWidth={2} />
            ))}
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (config.type === 'bar-horizontal') {
    return (
      <div className="p-2 h-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis dataKey="x" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }} width={70} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
            {config.series.map((s, i) => (
              <Bar key={i} dataKey={s.label || s.key} fill={s.color} radius={[0, 4, 4, 0]}>
                {!s.color.startsWith('#') ? null : data.map((_, j) => <Cell key={j} fill={CHART_COLORS[j % CHART_COLORS.length]} />)}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Area chart (default)
  const last = data[data.length - 1];
  const firstS = config.series[0];

  return (
    <div className="p-2 h-full flex flex-col">
      {config.showLabel && last && (
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[11px] font-bold text-slate-700">{config.showLabel}</span>
          <span className="text-lg font-black text-slate-900">{firstS ? last[firstS.label || firstS.key] : ''}</span>
        </div>
      )}
      <div className="flex-1">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="x" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11 }} />
            {config.series.map((s, i) => (
              <Area key={i} type="monotone" dataKey={s.label || s.key} stroke={s.color}
                fill={s.color} fillOpacity={s.stack ? 0.6 : 0.15} stackId={s.stack}
                strokeWidth={2} dot={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. GAUGE RENDERER
// Covers: feargreed, threats, single-value displays
// ═══════════════════════════════════════════════════════════════

export interface GaugeLevel {
  key: string;
  label: string;
  color: string;
  description?: string;
}

export interface GaugeConfig {
  endpoint?: string;
  mode: 'single' | 'levels';
  // single mode
  valueField?: string;
  labelField?: string;
  // levels mode (like threats)
  levels?: GaugeLevel[];
  statsKey?: string;   // key in stats for levels data
}

export function GaugeRenderer({ config, stats }: { config: GaugeConfig; stats?: Record<string, any> | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(!!config.endpoint);

  useEffect(() => {
    if (!config.endpoint) { setLoading(false); return; }
    api<any>(config.endpoint).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [config.endpoint]);

  if (loading) return <Loading />;

  // Single value mode (e.g., Fear & Greed)
  if (config.mode === 'single' && data) {
    const val = get(data, config.valueField || 'value') || 0;
    const label = get(data, config.labelField || 'classification') || '';
    const color = val <= 25 ? '#ef4444' : val <= 45 ? '#f97316' : val <= 55 ? '#eab308' : val <= 75 ? '#22c55e' : '#16a34a';
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-5xl font-black" style={{ color }}>{val}</div>
        <div className="text-sm font-bold text-slate-600">{label}</div>
        <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${val}%`, background: color }} />
        </div>
      </div>
    );
  }

  // Levels mode (e.g., threats breakdown)
  if (config.mode === 'levels' && config.levels && stats) {
    const source = config.statsKey ? stats[config.statsKey] : stats;
    const total = Object.values(source as Record<string, number>).reduce((a: number, b: any) => a + Number(b), 0) || 1;
    return (
      <div className="p-3 h-full space-y-2 overflow-y-auto">
        {config.levels.map(l => {
          const count = (source as any)[l.key] || 0;
          const pct = Math.round((count / total) * 100);
          return (
            <div key={l.key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-bold" style={{ color: l.color }}>{l.label}</span>
                <span className="text-[10px] text-slate-500">{count} ({pct}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: l.color }} />
              </div>
              {l.description && <p className="text-[8px] text-slate-400 mt-0.5">{l.description}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  return <Empty />;
}
