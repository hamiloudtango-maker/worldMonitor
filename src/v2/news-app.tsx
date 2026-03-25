import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:8000/api';
let token = localStorage.getItem('wm-access-token') || '';

async function api<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

interface Article {
  id: string; source_id: string; title: string; description: string;
  link: string; pub_date: string | null; lang: string; threat_level: string;
  theme: string; confidence: number; entities: string[]; country_codes: string[];
}
interface Stats { total: number; by_theme: Record<string, number>; by_threat: Record<string, number>; by_source: Record<string, number>; by_lang: Record<string, number>; }

const THEME_COLORS: Record<string, string> = {
  conflict: '#ef4444', military: '#f97316', economic: '#eab308', tech: '#3b82f6',
  diplomatic: '#a855f7', disaster: '#06b6d4', health: '#22c55e', cyber: '#14b8a6',
  protest: '#ec4899', crime: '#78716c', terrorism: '#dc2626', general: '#6b7280',
};
const ICONS: Record<string, string> = {
  conflict: '⚔️', military: '🎖️', economic: '💰', tech: '💻', diplomatic: '⚖️',
  disaster: '🌊', health: '🏥', cyber: '🛡️', protest: '✊', crime: '🔒',
  terrorism: '💣', general: '📄',
};
const FLAGS: Record<string, string> = {
  US: '🇺🇸', FR: '🇫🇷', UA: '🇺🇦', RU: '🇷🇺', CN: '🇨🇳', IR: '🇮🇷', IL: '🇮🇱',
  DE: '🇩🇪', GB: '🇬🇧', JP: '🇯🇵', IN: '🇮🇳', BR: '🇧🇷', TR: '🇹🇷', SA: '🇸🇦',
  KR: '🇰🇷', AU: '🇦🇺', CA: '🇨🇦', KP: '🇰🇵', PS: '🇵🇸', PH: '🇵🇭', NL: '🇳🇱',
};
const THREAT_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6b7280' };

function timeAgo(d: string | null): string {
  if (!d) return '';
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  return h < 1 ? 'Now' : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// ======== COMPONENTS ========

function KPICard({ icon, value, label, color }: { icon: string; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#121b2f] border border-slate-800/60 rounded-xl">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base`} style={{ background: `${color}18` }}>{icon}</div>
      <div>
        <div className="text-lg font-bold font-mono leading-none" style={{ color }}>{value}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function TimelineChart({ articles }: { articles: Article[] }) {
  const hours = new Array(48).fill(0);
  const now = Date.now();
  for (const a of articles) {
    if (!a.pub_date) continue;
    const idx = Math.floor((now - new Date(a.pub_date).getTime()) / 3600000);
    if (idx >= 0 && idx < 48) hours[47 - idx]++;
  }
  const max = Math.max(...hours, 1);

  return (
    <div className="bg-[#121b2f] border border-slate-800/60 rounded-xl p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-600 to-indigo-500" />
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Activity Timeline</h3>
          <p className="text-xs text-slate-500">Documents per hour (last 48h)</p>
        </div>
      </div>
      <div className="flex items-end gap-[2px] h-16">
        {hours.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-100 cursor-crosshair group relative"
            style={{
              height: `${Math.max(3, (h / max) * 100)}%`,
              background: h > max * 0.7 ? '#ef4444' : h > max * 0.4 ? '#f97316' : '#3b82f6',
              opacity: 0.4 + (h / max) * 0.6,
            }}
            title={`${h} articles`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-slate-600 font-mono">
        <span>-48h</span><span>-36h</span><span>-24h</span><span>-12h</span><span>Now</span>
      </div>
    </div>
  );
}

function FilterCheckbox({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-between w-full py-1.5 px-2 rounded text-xs transition-all ${active ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
      <div className="flex items-center gap-2">
        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] transition-all ${active ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-600'}`}>
          {active && '✓'}
        </div>
        <span>{label}</span>
      </div>
      {count > 0 && <span className="text-[9px] font-mono text-slate-600">[{count}]</span>}
    </button>
  );
}

function SearchPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 uppercase tracking-wider">
      <span className="opacity-60">keyword</span>
      <span className="font-bold normal-case">{label}</span>
      <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
    </div>
  );
}

function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const color = THREAT_COLORS[article.threat_level] || THREAT_COLORS.info;
  const flags = article.country_codes.map(c => FLAGS[c] || c).join(' ');
  const src = article.source_id.replace(/^gnews_/, '').replace(/_all$/, '').replace(/_/g, ' ');

  return (
    <a href={article.link} target="_blank" rel="noopener" className={`block bg-[#1a2340] border border-slate-800/60 rounded-xl overflow-hidden transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-black/30 hover:-translate-y-0.5 ${featured ? 'col-span-full' : ''}`}>
      <div className="h-[3px] w-full" style={{ background: color }} />
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">{src}</span>
          {article.pub_date && <span className="text-[9px] text-slate-500">{timeAgo(article.pub_date)}</span>}
          {article.lang !== 'en' && article.lang !== 'fr' && <span className="text-[8px] text-slate-500 bg-slate-800 px-1 rounded uppercase">{article.lang}</span>}
          {(article.threat_level === 'critical' || article.threat_level === 'high') && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{article.threat_level.toUpperCase()}</span>
          )}
        </div>
        <h3 className={`font-medium leading-snug line-clamp-2 ${featured ? 'text-[15px]' : 'text-[13px]'}`}>{article.title}</h3>
        {article.description && <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{article.description.slice(0, 200)}</p>}
        <div className="flex items-center gap-1.5 flex-wrap">
          {flags && <span className="text-xs">{flags}</span>}
          {article.entities.slice(0, 3).map(e => (
            <span key={e} className="text-[9px] font-medium text-blue-400 bg-blue-400/8 px-1.5 py-0.5 rounded">{e}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center px-3 py-1.5 border-t border-slate-800/40 bg-black/20 text-[9px] text-slate-500">
        <div className="flex gap-3">
          <span><span className="uppercase tracking-wide">Source</span> <span className="text-slate-400 font-mono">{src}</span></span>
          <span><span className="uppercase tracking-wide">Conf</span> <span className="text-slate-400 font-mono">{Math.round(article.confidence * 100)}%</span></span>
        </div>
        <span className="font-mono">#{article.id.slice(0, 6)}</span>
      </div>
    </a>
  );
}

function Section({ theme, articles }: { theme: string; articles: Article[] }) {
  const [open, setOpen] = useState(true);
  const color = THEME_COLORS[theme] || '#6b7280';

  return (
    <div className="border-b border-slate-800/40">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
          <span className="text-sm font-semibold">{ICONS[theme] || ''} {theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          <span className="text-[10px] text-slate-500 font-mono">{articles.length}</span>
        </div>
        <span className={`text-[10px] text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`}>▾</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-4 pb-3">
          {articles.map((a, i) => <ArticleCard key={a.id} article={a} featured={i === 0} />)}
        </div>
      )}
    </div>
  );
}

// ======== MAIN ========

export default function NewsIntelligence() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [themes, setThemes] = useState<[string, number][]>([]);
  const [countries, setCountries] = useState<[string, number][]>([]);
  const [entities, setEntities] = useState<[string, number][]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({ country: '', theme: '', entity: '', threat: '', q: '' });
  const [loading, setLoading] = useState(true);

  const setFilter = useCallback((key: string, val: string) => {
    setFilters(f => ({ ...f, [key]: f[key as keyof typeof f] === val ? '' : val }));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams({ limit: '200' });
      if (filters.theme || activeTab !== 'all') params.set('theme', filters.theme || activeTab);
      if (filters.country) params.set('country', filters.country);
      if (filters.entity) params.set('entity', filters.entity);
      if (filters.threat) params.set('threat', filters.threat);
      if (filters.q) params.set('q', filters.q);

      const [data, st, th, co, en] = await Promise.all([
        api<{ articles: Article[]; total: number }>(`/articles/v1/search?${params}`),
        api<Stats>('/articles/v1/stats'),
        api<{ themes: [string, number][] }>('/articles/v1/themes'),
        api<{ countries: [string, number][] }>('/articles/v1/countries'),
        api<{ entities: [string, number][] }>('/articles/v1/entities?limit=15'),
      ]);
      setArticles(data.articles);
      setStats(st);
      setThemes(th.themes);
      setCountries(co.countries);
      setEntities(en.entities);
      setLoading(false);
    };
    load();
  }, [filters, activeTab]);

  const grouped: Record<string, Article[]> = {};
  for (const a of articles) (grouped[a.theme || 'general'] ??= []).push(a);
  const sortedGroups = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  const activeFilters = Object.entries(filters).filter(([_, v]) => v);

  return (
    <div className="flex h-full bg-[#0b1121] text-slate-200 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0f172a] border-r border-slate-800/50 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-slate-800/50 flex justify-between items-center">
          <h2 className="text-base font-semibold text-white">Refine</h2>
          <button onClick={() => { setFilters({ country: '', theme: '', entity: '', threat: '', q: '' }); setActiveTab('all'); }} className="text-xs text-slate-500 hover:text-blue-400 transition-colors">Clear all</button>
        </div>
        <div className="p-3">
          <input
            type="text"
            placeholder="Search articles..."
            value={filters.q}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
            className="w-full bg-[#1e293b] border border-slate-700/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Themes */}
          <div className="mb-3">
            <h3 className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">Themes <span className="text-[9px] text-blue-400 bg-blue-400/10 px-1 rounded">{themes.length}</span></h3>
            {themes.map(([t, c]) => <FilterCheckbox key={t} label={`${ICONS[t] || ''} ${t}`} count={c} active={filters.theme === t} onClick={() => setFilter('theme', t)} />)}
          </div>
          <hr className="border-slate-800/50" />
          {/* Countries */}
          <div className="mb-3 mt-3">
            <h3 className="text-xs font-semibold text-slate-400 mb-1.5">Countries</h3>
            {countries.slice(0, 12).map(([code, c]) => <FilterCheckbox key={code} label={`${FLAGS[code] || '🌐'} ${code}`} count={c} active={filters.country === code} onClick={() => setFilter('country', code)} />)}
          </div>
          <hr className="border-slate-800/50" />
          {/* Threat */}
          <div className="mb-3 mt-3">
            <h3 className="text-xs font-semibold text-slate-400 mb-1.5">Threat Level</h3>
            {(['critical', 'high', 'medium', 'low'] as const).map(t => <FilterCheckbox key={t} label={`● ${t.charAt(0).toUpperCase() + t.slice(1)}`} count={0} active={filters.threat === t} onClick={() => setFilter('threat', t)} />)}
          </div>
          <hr className="border-slate-800/50" />
          {/* Entities */}
          <div className="mt-3">
            <h3 className="text-xs font-semibold text-slate-400 mb-1.5">Top Entities</h3>
            {entities.map(([n, c]) => <FilterCheckbox key={n} label={n} count={c} active={filters.entity === n} onClick={() => setFilter('entity', n)} />)}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar with keyword chips */}
        <div className="px-4 py-2 border-b border-slate-800/50 bg-[#0f172a]/80 backdrop-blur-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeFilters.map(([k, v]) => <SearchPill key={k} label={`${k}: ${v}`} onRemove={() => setFilters(f => ({ ...f, [k]: '' }))} />)}
            {activeFilters.length === 0 && <span className="text-xs text-slate-500">No active filters</span>}
          </div>
          <span className="text-xs text-slate-500"><span className="font-mono font-semibold text-white">{stats?.total || 0}</span> results</span>
        </div>

        {/* Category tabs */}
        <div className="flex gap-0 border-b border-slate-800/50 bg-[#0f172a] px-4 overflow-x-auto">
          <button onClick={() => setActiveTab('all')} className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'all' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            All <span className="text-[9px] bg-slate-800 px-1.5 rounded font-mono ml-1">{stats?.total || 0}</span>
          </button>
          {themes.slice(0, 8).map(([t, c]) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === t ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              <div className="w-1.5 h-1.5 rounded-sm" style={{ background: THEME_COLORS[t] }} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <span className="text-[9px] bg-slate-800 px-1.5 rounded font-mono">{c}</span>
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Loading intelligence...</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-5 gap-2">
                <KPICard icon="📊" value={stats?.total || 0} label="Articles" color="#3b82f6" />
                <KPICard icon="🔴" value={stats?.by_threat['critical'] || 0} label="Critical" color="#ef4444" />
                <KPICard icon="🟠" value={stats?.by_threat['high'] || 0} label="High" color="#f97316" />
                <KPICard icon="🏷️" value={Object.keys(stats?.by_theme || {}).length} label="Themes" color="#a855f7" />
                <KPICard icon="🌐" value={Object.keys(stats?.by_lang || {}).length} label="Languages" color="#22c55e" />
              </div>

              {/* Timeline */}
              <TimelineChart articles={articles} />

              {/* Sections */}
              <div className="bg-[#0f172a] border border-slate-800/60 rounded-xl overflow-hidden">
                {sortedGroups.map(([theme, arts]) => <Section key={theme} theme={theme} articles={arts} />)}
                {sortedGroups.length === 0 && <div className="p-8 text-center text-slate-500">No articles match your criteria</div>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
