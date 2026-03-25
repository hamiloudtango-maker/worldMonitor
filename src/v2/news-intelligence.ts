/**
 * News Intelligence — OSINT investigation-grade UI.
 * Babel X / Cobwebs inspired: category tabs, keyword chips, sectioned cards, timeline.
 */

import { apiFetch } from '@/services/api-client';

interface Article {
  id: string; source_id: string; title: string; title_translated: string | null;
  description: string; link: string; pub_date: string | null; lang: string;
  threat_level: string; theme: string; confidence: number;
  entities: string[]; country_codes: string[];
}

interface Stats { total: number; by_theme: Record<string, number>; by_threat: Record<string, number>; by_source: Record<string, number>; by_lang: Record<string, number>; }

const ICONS: Record<string, string> = {
  conflict: '⚔️', economic: '💰', tech: '💻', military: '🎖️', disaster: '🌊',
  health: '🏥', cyber: '🛡️', diplomatic: '⚖️', protest: '✊', crime: '🔒',
  environmental: '🌱', terrorism: '💣', general: '📄', infrastructure: '🏗️',
};
const COLORS: Record<string, string> = {
  conflict: '#ef4444', military: '#f97316', economic: '#eab308', tech: '#3b82f6',
  diplomatic: '#a855f7', disaster: '#06b6d4', health: '#22c55e', cyber: '#14b8a6',
  protest: '#ec4899', general: '#6b7280', crime: '#78716c', terrorism: '#dc2626',
  environmental: '#22c55e', infrastructure: '#6b7280',
};
const THREAT: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6b7280' };
const FLAGS: Record<string, string> = {
  US: '🇺🇸', FR: '🇫🇷', UA: '🇺🇦', RU: '🇷🇺', CN: '🇨🇳', IR: '🇮🇷', IL: '🇮🇱',
  DE: '🇩🇪', GB: '🇬🇧', JP: '🇯🇵', IN: '🇮🇳', BR: '🇧🇷', TR: '🇹🇷', SA: '🇸🇦',
  KR: '🇰🇷', PH: '🇵🇭', AU: '🇦🇺', CA: '🇨🇦', KP: '🇰🇵', NL: '🇳🇱', PS: '🇵🇸',
};

let filters = { country: '', theme: '', entity: '', threat: '', q: '' };
let activeTab = 'all';

export async function renderNewsIntelligence(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="wm-news-layout">
      <aside class="wm-news-sidebar" id="news-sidebar">
        <div class="wm-sidebar-header">Refine <span id="clear-filters">Clear all</span></div>
        <div class="wm-news-search-wrap"><input type="text" id="news-search" placeholder="Search articles..." class="wm-news-search-input" /></div>
        <div id="sidebar-filters"><div class="wm-sidebar-loading">Loading...</div></div>
      </aside>
      <main class="wm-news-main" id="news-main">
        <div id="news-topbar" class="wm-news-topbar">
          <div class="wm-news-topbar-left" id="keyword-chips"></div>
          <div class="wm-news-topbar-right"><span class="wm-result-count" id="result-count">—</span> results</div>
        </div>
        <div id="cat-tabs" class="wm-cat-tabs"></div>
        <div class="wm-news-scroll" id="news-scroll">
          <div id="news-kpis"></div>
          <div id="news-timeline"></div>
          <div id="news-content" class="wm-news-content"><div class="wm-loading">Loading intelligence...</div></div>
        </div>
      </main>
    </div>
  `;

  document.getElementById('clear-filters')!.onclick = () => { filters = { country: '', theme: '', entity: '', threat: '', q: '' }; activeTab = 'all'; refresh(); };

  let st: ReturnType<typeof setTimeout>;
  document.getElementById('news-search')!.addEventListener('input', (e) => { clearTimeout(st); st = setTimeout(() => { filters.q = (e.target as HTMLInputElement).value; refresh(); }, 300); });

  await refresh();
}

async function refresh() { await Promise.all([loadSidebar(), loadContent()]); }

async function loadSidebar() {
  const el = document.getElementById('sidebar-filters')!;
  try {
    const [themes, countries, entities] = await Promise.all([
      apiFetch<{ themes: [string, number][] }>('/articles/v1/themes'),
      apiFetch<{ countries: [string, number][] }>('/articles/v1/countries'),
      apiFetch<{ entities: [string, number][] }>('/articles/v1/entities?limit=15'),
    ]);

    el.innerHTML = [
      filterSection('Themes', 'theme', themes.themes.map(([t, c]) => ({ label: `${ICONS[t] || ''} ${t}`, value: t, count: c }))),
      filterSection('Countries', 'country', countries.countries.slice(0, 15).map(([code, c]) => ({ label: `${FLAGS[code] || '🌐'} ${code}`, value: code, count: c }))),
      filterSection('Threat Level', 'threat', ['critical', 'high', 'medium', 'low'].map(t => ({ label: `<span style="color:${THREAT[t]}">●</span> ${t.charAt(0).toUpperCase() + t.slice(1)}`, value: t, count: 0 }))),
      filterSection('Top Entities', 'entity', entities.entities.map(([n, c]) => ({ label: n, value: n, count: c }))),
    ].join('');

    el.querySelectorAll('.wm-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = (btn as HTMLElement).dataset.filter!;
        const v = (btn as HTMLElement).dataset.value!;
        const key = f as keyof typeof filters;
        if (filters[key] === v) { filters[key] = ''; btn.classList.remove('active'); }
        else { el.querySelectorAll(`.wm-filter-chip[data-filter="${f}"]`).forEach(b => b.classList.remove('active')); filters[key] = v; btn.classList.add('active'); }
        updateChips(); loadContent();
      });
    });
  } catch { el.innerHTML = '<div class="wm-sidebar-loading">Failed</div>'; }
}

function filterSection(title: string, filter: string, items: { label: string; value: string; count: number }[]): string {
  if (!items.length) return '';
  return `<div class="wm-filter-section"><div class="wm-filter-title">${title} <span class="wm-filter-badge">[${items.length}]</span></div>
    <div class="wm-filter-list">${items.map(i => `
      <button class="wm-filter-chip${filters[filter as keyof typeof filters] === i.value ? ' active' : ''}" data-filter="${filter}" data-value="${i.value}">
        <span class="wm-filter-check">${filters[filter as keyof typeof filters] === i.value ? '✓' : ''}</span>
        <span style="flex:1">${i.label}</span>
        ${i.count ? `<span class="wm-filter-count">${i.count}</span>` : ''}
      </button>`).join('')}
    </div></div>`;
}

function updateChips() {
  const el = document.getElementById('keyword-chips')!;
  const active = Object.entries(filters).filter(([_, v]) => v);
  el.innerHTML = active.map(([k, v]) => {
    return `<span class="wm-keyword-chip ${v in COLORS ? v : 'default'}">${k.toUpperCase()} <b>${esc(v)}</b> <button class="wm-chip-remove" data-key="${k}">×</button></span>`;
  }).join('');
  el.querySelectorAll('.wm-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); filters[(btn as HTMLElement).dataset.key as keyof typeof filters] = ''; updateChips(); loadContent(); refresh(); });
  });
}

async function loadContent() {
  const params = new URLSearchParams({ limit: '200' });
  if (filters.country) params.set('country', filters.country);
  if (filters.theme) params.set('theme', filters.theme);
  if (filters.entity) params.set('entity', filters.entity);
  if (filters.threat) params.set('threat', filters.threat);
  if (filters.q) params.set('q', filters.q);
  if (activeTab !== 'all') params.set('theme', activeTab);

  const content = document.getElementById('news-content')!;
  content.innerHTML = '<div class="wm-loading">Loading intelligence...</div>';

  try {
    const [data, stats] = await Promise.all([
      apiFetch<{ articles: Article[]; total: number }>(`/articles/v1/search?${params}`),
      apiFetch<Stats>('/articles/v1/stats'),
    ]);

    document.getElementById('result-count')!.textContent = String(data.total);
    renderKPIs(stats);
    renderTimeline(data.articles);
    renderCatTabs(stats);

    if (!data.articles.length) { content.innerHTML = '<div class="wm-news-empty">No articles match your criteria</div>'; return; }

    // Group by theme
    const groups: Record<string, Article[]> = {};
    for (const a of data.articles) { (groups[a.theme || 'general'] ??= []).push(a); }
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    content.innerHTML = '';
    for (const [theme, articles] of sorted) content.appendChild(renderSection(theme, articles));
  } catch (err) {
    content.innerHTML = `<div class="wm-news-empty">Error: ${err instanceof Error ? err.message : 'Failed'}</div>`;
  }
}

function renderKPIs(stats: Stats) {
  const el = document.getElementById('news-kpis')!;
  const c = stats.by_threat['critical'] || 0;
  const h = stats.by_threat['high'] || 0;
  const t = Object.keys(stats.by_theme).length;
  const sources = Object.keys(stats.by_source).length;
  const langs = Object.keys(stats.by_lang).length;
  el.innerHTML = `<div class="wm-kpi-strip">
    <div class="wm-kpi-card"><div class="wm-kpi-icon blue">📊</div><div class="wm-kpi-info"><div class="wm-kpi-value">${stats.total}</div><div class="wm-kpi-label">Articles</div></div></div>
    <div class="wm-kpi-card"><div class="wm-kpi-icon red">🔴</div><div class="wm-kpi-info"><div class="wm-kpi-value" style="color:#ef4444">${c}</div><div class="wm-kpi-label">Critical</div></div></div>
    <div class="wm-kpi-card"><div class="wm-kpi-icon orange">🟠</div><div class="wm-kpi-info"><div class="wm-kpi-value" style="color:#f97316">${h}</div><div class="wm-kpi-label">High</div></div></div>
    <div class="wm-kpi-card"><div class="wm-kpi-icon purple">🏷️</div><div class="wm-kpi-info"><div class="wm-kpi-value">${t}</div><div class="wm-kpi-label">Themes</div></div></div>
    <div class="wm-kpi-card"><div class="wm-kpi-icon green">🌐</div><div class="wm-kpi-info"><div class="wm-kpi-value">${langs}</div><div class="wm-kpi-label">Languages</div></div></div>
  </div>`;
}

function renderTimeline(articles: Article[]) {
  const el = document.getElementById('news-timeline')!;
  const now = Date.now();
  const hours = new Array(48).fill(0);
  for (const a of articles) { if (!a.pub_date) continue; const idx = Math.floor((now - new Date(a.pub_date).getTime()) / 3600000); if (idx >= 0 && idx < 48) hours[47 - idx] = (hours[47 - idx] ?? 0) + 1; }
  const max = Math.max(...hours, 1);

  el.innerHTML = `<div class="wm-timeline-section">
    <div class="wm-timeline-header"><span class="wm-timeline-title">Articles / Hour</span><span class="wm-timeline-range">Last 48 hours</span></div>
    <div class="wm-timeline-chart">${hours.map((h) => `<div class="wm-timeline-bar ${h > max * 0.7 ? 'red' : h > max * 0.4 ? 'orange' : 'accent'}" style="height:${Math.max(2, (h / max) * 42)}px;opacity:${0.4 + (h / max) * 0.6}" title="${h} articles"></div>`).join('')}</div>
    <div class="wm-timeline-labels"><span>-48h</span><span>-36h</span><span>-24h</span><span>-12h</span><span>Now</span></div>
  </div>`;
}

function renderCatTabs(stats: Stats) {
  const el = document.getElementById('cat-tabs')!;
  const themes = Object.entries(stats.by_theme).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `<button class="wm-cat-tab ${activeTab === 'all' ? 'active' : ''}" data-cat="all">All <span class="wm-cat-count">${stats.total}</span></button>`
    + themes.slice(0, 8).map(([t, c]) => `<button class="wm-cat-tab ${activeTab === t ? 'active' : ''}" data-cat="${t}"><span class="wm-dot wm-dot-${t}"></span> ${t.charAt(0).toUpperCase() + t.slice(1)} <span class="wm-cat-count">${c}</span></button>`).join('');

  el.querySelectorAll('.wm-cat-tab').forEach(tab => {
    tab.addEventListener('click', () => { activeTab = (tab as HTMLElement).dataset.cat!; loadContent(); });
  });
}

function renderSection(theme: string, articles: Article[]): HTMLElement {
  const s = document.createElement('div');
  s.className = 'wm-section';
  const color = COLORS[theme] || '#6b7280';

  s.innerHTML = `
    <div class="wm-section-header">
      <div class="wm-section-left">
        <div class="wm-section-dot" style="background:${color}"></div>
        <span class="wm-section-title">${ICONS[theme] || ''} ${theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
        <span class="wm-section-count">${articles.length}</span>
      </div>
      <span class="wm-section-toggle">▾</span>
    </div>
    <div class="wm-section-body"></div>
  `;

  s.querySelector('.wm-section-header')!.addEventListener('click', () => s.classList.toggle('collapsed'));

  const body = s.querySelector('.wm-section-body')!;
  articles.forEach((a, i) => body.appendChild(renderCard(a, i === 0)));
  return s;
}

function renderCard(a: Article, featured: boolean): HTMLElement {
  const el = document.createElement('a');
  el.className = `wm-article-card${featured ? ' wm-article-featured' : ''}`;
  el.href = a.link;
  el.target = '_blank';
  el.rel = 'noopener';

  const color = THREAT[a.threat_level] || THREAT.info;
  const flags = a.country_codes.map(c => FLAGS[c] || c).join(' ');
  const src = a.source_id.replace(/^gnews_/, '').replace(/_all$/, '').replace(/_/g, ' ');

  let timeAgo = '';
  if (a.pub_date) { const h = Math.floor((Date.now() - new Date(a.pub_date).getTime()) / 3600000); timeAgo = h < 1 ? 'Just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`; }

  const threatTag = (a.threat_level === 'critical' || a.threat_level === 'high') ? `<span class="wm-tag wm-tag-threat-${a.threat_level}">${a.threat_level.toUpperCase()}</span>` : '';

  el.innerHTML = `
    <div class="wm-article-bar" style="background:${color}"></div>
    <div class="wm-article-body">
      <div class="wm-article-meta">
        <span class="wm-article-source-badge">${esc(src)}</span>
        ${timeAgo ? `<span class="wm-article-time">${timeAgo}</span>` : ''}
        ${a.lang !== 'en' && a.lang !== 'fr' ? `<span class="wm-article-time">${a.lang.toUpperCase()}</span>` : ''}
        ${threatTag}
      </div>
      <div class="wm-article-title">${esc(a.title)}</div>
      ${a.description ? `<div class="wm-article-desc">${esc(a.description.slice(0, 200))}</div>` : ''}
      <div class="wm-article-tags">
        ${flags ? `<span class="wm-tag wm-tag-country">${flags}</span>` : ''}
        ${a.entities.slice(0, 3).map(e => `<span class="wm-tag wm-tag-entity">${esc(e)}</span>`).join('')}
      </div>
    </div>
    <div class="wm-article-footer">
      <div class="wm-article-footer-left">
        <div class="wm-article-footer-item"><span class="wm-article-footer-label">Source</span> <span class="wm-article-footer-value">${esc(src)}</span></div>
        <div class="wm-article-footer-item"><span class="wm-article-footer-label">Confidence</span> <span class="wm-article-footer-value">${Math.round(a.confidence * 100)}%</span></div>
      </div>
      <div class="wm-article-footer-item"><span class="wm-article-footer-label">ID</span> <span class="wm-article-footer-value">#${a.id.slice(0, 6)}</span></div>
    </div>
  `;
  return el;
}

function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
