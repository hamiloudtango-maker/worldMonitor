/**
 * News Intelligence — OSINT-grade unified article view.
 * KPI strip + timeline histogram + sectioned articles + sidebar filters.
 */

import { apiFetch } from '@/services/api-client';

interface Article {
  id: string;
  source_id: string;
  title: string;
  title_translated: string | null;
  description: string;
  link: string;
  pub_date: string | null;
  lang: string;
  threat_level: string;
  theme: string;
  confidence: number;
  entities: string[];
  country_codes: string[];
}

interface Stats {
  total: number;
  by_theme: Record<string, number>;
  by_threat: Record<string, number>;
  by_source: Record<string, number>;
  by_lang: Record<string, number>;
}

interface FilterState {
  country: string;
  theme: string;
  entity: string;
  threat: string;
  q: string;
}

const THEME_ICONS: Record<string, string> = {
  conflict: '⚔️', economic: '💰', tech: '💻', military: '🎖️',
  disaster: '🌊', health: '🏥', cyber: '🛡️', diplomatic: '⚖️',
  protest: '✊', crime: '🔒', environmental: '🌱', infrastructure: '🏗️',
  terrorism: '💣', general: '📄',
};

const THREAT_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#6b7280',
};

const FLAGS: Record<string, string> = {
  US: '🇺🇸', FR: '🇫🇷', UA: '🇺🇦', RU: '🇷🇺', CN: '🇨🇳', IR: '🇮🇷', IL: '🇮🇱',
  DE: '🇩🇪', GB: '🇬🇧', JP: '🇯🇵', IN: '🇮🇳', BR: '🇧🇷', TR: '🇹🇷', SA: '🇸🇦',
  KR: '🇰🇷', PH: '🇵🇭', AU: '🇦🇺', CA: '🇨🇦', IT: '🇮🇹', ES: '🇪🇸', PL: '🇵🇱',
  PS: '🇵🇸', LB: '🇱🇧', SY: '🇸🇾', IQ: '🇮🇶', YE: '🇾🇪', EG: '🇪🇬', NG: '🇳🇬',
  KE: '🇰🇪', ZA: '🇿🇦', MX: '🇲🇽', NL: '🇳🇱', SE: '🇸🇪', DK: '🇩🇰', KP: '🇰🇵',
};

let filters: FilterState = { country: '', theme: '', entity: '', threat: '', q: '' };

export async function renderNewsIntelligence(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="wm-news-layout">
      <aside class="wm-news-sidebar" id="news-sidebar">
        <input type="text" id="news-search" placeholder="Search articles..." class="wm-news-search-input" />
        <div id="sidebar-filters"><div class="wm-sidebar-loading">Loading...</div></div>
      </aside>
      <main class="wm-news-main" id="news-main">
        <div id="news-kpi"></div>
        <div id="news-timeline"></div>
        <div id="news-toolbar" class="wm-news-toolbar" style="display:none">
          <h2 id="news-view-title">All Intelligence</h2>
          <div class="wm-active-filters" id="active-filters"></div>
          <span class="wm-news-count" id="news-count"></span>
        </div>
        <div id="news-content" class="wm-news-content">
          <div class="wm-loading">Loading intelligence...</div>
        </div>
      </main>
    </div>
  `;

  // Search
  let searchTimer: ReturnType<typeof setTimeout>;
  document.getElementById('news-search')!.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filters.q = (e.target as HTMLInputElement).value; refresh(); }, 300);
  });

  await refresh();
}

async function refresh(): Promise<void> {
  await Promise.all([loadKPIs(), loadSidebar(), loadArticles()]);
}

// ===== KPIs =====
async function loadKPIs(): Promise<void> {
  const el = document.getElementById('news-kpi')!;
  try {
    const stats = await apiFetch<Stats>('/articles/v1/stats');
    const critical = stats.by_threat['critical'] || 0;
    const high = stats.by_threat['high'] || 0;
    const themes = Object.keys(stats.by_theme).length;
    const sources = Object.keys(stats.by_source).length;

    el.innerHTML = `<div class="wm-kpi-strip">
      <div class="wm-kpi-card"><div class="wm-kpi-value accent">${stats.total}</div><div class="wm-kpi-label">Total Articles</div></div>
      <div class="wm-kpi-card"><div class="wm-kpi-value critical">${critical}</div><div class="wm-kpi-label">Critical</div></div>
      <div class="wm-kpi-card"><div class="wm-kpi-value high">${high}</div><div class="wm-kpi-label">High Priority</div></div>
      <div class="wm-kpi-card"><div class="wm-kpi-value muted">${themes}</div><div class="wm-kpi-label">Themes</div></div>
      <div class="wm-kpi-card"><div class="wm-kpi-value muted">${sources}</div><div class="wm-kpi-label">Sources</div></div>
    </div>`;
  } catch {
    el.innerHTML = '';
  }
}

// ===== Sidebar =====
async function loadSidebar(): Promise<void> {
  const el = document.getElementById('sidebar-filters')!;
  try {
    const [themes, countries, entities] = await Promise.all([
      apiFetch<{ themes: [string, number][] }>('/articles/v1/themes'),
      apiFetch<{ countries: [string, number][] }>('/articles/v1/countries'),
      apiFetch<{ entities: [string, number][] }>('/articles/v1/entities?limit=20'),
    ]);

    el.innerHTML = [
      renderFilterSection('Themes', 'theme', themes.themes.map(([t, c]) => ({ label: `${THEME_ICONS[t] || '📄'} ${t}`, value: t, count: c }))),
      renderFilterSection('Countries', 'country', countries.countries.slice(0, 15).map(([code, c]) => ({ label: `${FLAGS[code] || '🌐'} ${code}`, value: code, count: c }))),
      renderFilterSection('Threat', 'threat', ['critical', 'high', 'medium', 'low'].map(t => ({ label: `<span style="color:${THREAT_COLORS[t]}">●</span> ${t.toUpperCase()}`, value: t, count: 0 }))),
      renderFilterSection('Entities', 'entity', entities.entities.map(([n, c]) => ({ label: n, value: n, count: c }))),
    ].join('');

    el.querySelectorAll('.wm-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = (btn as HTMLElement).dataset.filter as keyof FilterState;
        const v = (btn as HTMLElement).dataset.value!;
        if (filters[f] === v) { filters[f] = ''; btn.classList.remove('active'); }
        else {
          el.querySelectorAll(`.wm-filter-chip[data-filter="${f}"]`).forEach(b => b.classList.remove('active'));
          filters[f] = v; btn.classList.add('active');
        }
        updateToolbar();
        loadArticles();
      });
    });
  } catch {
    el.innerHTML = '<div class="wm-sidebar-loading">Failed to load filters</div>';
  }
}

function renderFilterSection(title: string, filter: string, items: { label: string; value: string; count: number }[]): string {
  if (!items.length) return '';
  return `<div class="wm-filter-section">
    <div class="wm-filter-title">${title}</div>
    <div class="wm-filter-list">${items.map(i => `
      <button class="wm-filter-chip${filters[filter as keyof FilterState] === i.value ? ' active' : ''}" data-filter="${filter}" data-value="${i.value}">
        <span>${i.label}</span>
        ${i.count ? `<span class="wm-filter-count">${i.count}</span>` : ''}
      </button>
    `).join('')}</div>
  </div>`;
}

function updateToolbar(): void {
  const toolbar = document.getElementById('news-toolbar')!;
  const title = document.getElementById('news-view-title')!;
  const filtersEl = document.getElementById('active-filters')!;
  const active = Object.entries(filters).filter(([_, v]) => v);

  if (active.length === 0) {
    toolbar.style.display = 'none';
    return;
  }

  toolbar.style.display = '';
  title.textContent = 'Filtered';
  filtersEl.innerHTML = active.map(([k, v]) => `
    <span class="wm-active-filter">${k}: ${v} <button class="wm-filter-remove" data-key="${k}">×</button></span>
  `).join('');

  filtersEl.querySelectorAll('.wm-filter-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = (btn as HTMLElement).dataset.key as keyof FilterState;
      filters[key] = '';
      document.querySelectorAll(`.wm-filter-chip[data-filter="${key}"]`).forEach(b => b.classList.remove('active'));
      updateToolbar();
      loadArticles();
    });
  });
}

// ===== Articles =====
async function loadArticles(): Promise<void> {
  const content = document.getElementById('news-content')!;
  const countEl = document.getElementById('news-count');
  content.innerHTML = '<div class="wm-loading">Loading intelligence...</div>';

  const params = new URLSearchParams({ limit: '200' });
  if (filters.country) params.set('country', filters.country);
  if (filters.theme) params.set('theme', filters.theme);
  if (filters.entity) params.set('entity', filters.entity);
  if (filters.threat) params.set('threat', filters.threat);
  if (filters.q) params.set('q', filters.q);

  try {
    const data = await apiFetch<{ articles: Article[]; total: number }>(`/articles/v1/search?${params}`);

    if (countEl) countEl.textContent = `${data.total} articles`;

    if (!data.articles.length) {
      content.innerHTML = '<div class="wm-news-empty">No articles match your filters</div>';
      return;
    }

    // Build timeline
    buildTimeline(data.articles);

    // Group by theme
    const byTheme: Record<string, Article[]> = {};
    for (const a of data.articles) {
      const t = a.theme || 'general';
      (byTheme[t] ??= []).push(a);
    }

    // Sort themes by article count
    const sortedThemes = Object.entries(byTheme).sort((a, b) => b[1].length - a[1].length);

    content.innerHTML = '';
    for (const [theme, articles] of sortedThemes) {
      content.appendChild(renderSection(theme, articles));
    }
  } catch (err) {
    content.innerHTML = `<div class="wm-news-empty">Error: ${err instanceof Error ? err.message : 'Failed'}</div>`;
  }
}

function buildTimeline(articles: Article[]): void {
  const el = document.getElementById('news-timeline')!;
  // Group by hour (last 72h)
  const now = Date.now();
  const hours: number[] = new Array(72).fill(0);
  for (const a of articles) {
    if (!a.pub_date) continue;
    const age = (now - new Date(a.pub_date).getTime()) / 3600000;
    const idx = Math.floor(age);
    if (idx >= 0 && idx < 72) hours[71 - idx] = (hours[71 - idx] ?? 0) + 1;
  }
  const max = Math.max(...hours, 1);
  el.innerHTML = `<div class="wm-timeline-bar">${hours.map(h =>
    `<div class="wm-timeline-col" style="height:${Math.max(2, (h / max) * 28)}px" title="${h} articles"></div>`
  ).join('')}</div>`;
}

function renderSection(theme: string, articles: Article[]): HTMLElement {
  const section = document.createElement('div');
  section.className = 'wm-section';

  const icon = THEME_ICONS[theme] || '📄';
  section.innerHTML = `
    <div class="wm-section-header">
      <div class="wm-section-title">${icon} ${theme.charAt(0).toUpperCase() + theme.slice(1)} <span class="wm-section-count">${articles.length}</span></div>
      <span class="wm-section-toggle">▼</span>
    </div>
    <div class="wm-section-body"></div>
  `;

  const header = section.querySelector('.wm-section-header')!;
  header.addEventListener('click', () => section.classList.toggle('collapsed'));

  const body = section.querySelector('.wm-section-body')!;

  // First article = featured
  if (articles[0]) body.appendChild(renderArticle(articles[0], true));
  for (const a of articles.slice(1)) body.appendChild(renderArticle(a, false));

  return section;
}

function renderArticle(a: Article, featured: boolean): HTMLElement {
  const el = document.createElement('a');
  el.className = featured ? 'wm-article-featured' : 'wm-article-card';
  el.href = a.link;
  el.target = '_blank';
  el.rel = 'noopener';

  const color = THREAT_COLORS[a.threat_level] || THREAT_COLORS.info;
  const flags = a.country_codes.map(c => FLAGS[c] || c).join(' ');

  let timeAgo = '';
  if (a.pub_date) {
    const diff = Date.now() - new Date(a.pub_date).getTime();
    const h = Math.floor(diff / 3600000);
    timeAgo = h < 1 ? `${Math.floor(diff / 60000)}m` : h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
  }

  const threatTag = a.threat_level === 'critical' || a.threat_level === 'high'
    ? `<span class="wm-tag wm-tag-threat-${a.threat_level}">${a.threat_level.toUpperCase()}</span>` : '';

  el.innerHTML = `
    <div class="wm-article-threat" style="background:${color}"></div>
    <div class="wm-article-content">
      <div class="wm-article-meta">
        <span class="wm-article-source">${esc(a.source_id.replace(/^gnews_/, ''))}</span>
        ${timeAgo ? `<span class="wm-article-time">${timeAgo}</span>` : ''}
        ${a.lang !== 'en' && a.lang !== 'fr' ? `<span class="wm-article-lang">${a.lang}</span>` : ''}
      </div>
      <div class="wm-article-title">${esc(a.title)}</div>
      ${a.description ? `<div class="wm-article-desc">${esc(a.description.slice(0, 200))}</div>` : ''}
      <div class="wm-article-tags">
        ${threatTag}
        ${flags ? `<span class="wm-tag wm-tag-country">${flags}</span>` : ''}
        ${a.entities.slice(0, 3).map(e => `<span class="wm-tag wm-tag-entity">${esc(e)}</span>`).join('')}
      </div>
    </div>
  `;
  return el;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
