/**
 * News Intelligence — unified article view with filters.
 * Inspired by Google News: sidebar filters + clustered articles.
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

interface FilterState {
  country: string;
  theme: string;
  entity: string;
  threat: string;
  source: string;
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

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸', FR: '🇫🇷', UA: '🇺🇦', RU: '🇷🇺', CN: '🇨🇳', IR: '🇮🇷', IL: '🇮🇱',
  DE: '🇩🇪', GB: '🇬🇧', JP: '🇯🇵', IN: '🇮🇳', BR: '🇧🇷', TR: '🇹🇷', SA: '🇸🇦',
  KR: '🇰🇷', PH: '🇵🇭', AU: '🇦🇺', CA: '🇨🇦', IT: '🇮🇹', ES: '🇪🇸', PL: '🇵🇱',
  PS: '🇵🇸', LB: '🇱🇧', SY: '🇸🇾', IQ: '🇮🇶', YE: '🇾🇪', EG: '🇪🇬', NG: '🇳🇬',
  KE: '🇰🇪', ZA: '🇿🇦', MX: '🇲🇽', AR: '🇦🇷', CL: '🇨🇱', CO: '🇨🇴',
};

let currentFilters: FilterState = { country: '', theme: '', entity: '', threat: '', source: '', q: '' };

export async function renderNewsIntelligence(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="wm-news-layout">
      <aside class="wm-news-sidebar" id="news-sidebar">
        <div class="wm-news-search">
          <input type="text" id="news-search" placeholder="Search articles..." class="wm-news-search-input" />
        </div>
        <div id="sidebar-filters">
          <div class="wm-sidebar-loading">Loading filters...</div>
        </div>
      </aside>
      <main class="wm-news-main" id="news-main">
        <div class="wm-news-header">
          <h2 id="news-view-title">All News</h2>
          <div id="active-filters" class="wm-active-filters"></div>
        </div>
        <div id="news-articles" class="wm-news-articles">
          <div class="wm-loading">Loading articles...</div>
        </div>
      </main>
    </div>
  `;

  // Load sidebar filters
  await loadSidebarFilters();

  // Search input
  let searchTimeout: ReturnType<typeof setTimeout>;
  document.getElementById('news-search')!.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentFilters.q = (e.target as HTMLInputElement).value;
      loadArticles();
    }, 300);
  });

  // Initial load
  await loadArticles();
}

async function loadSidebarFilters(): Promise<void> {
  const sidebar = document.getElementById('sidebar-filters')!;

  const [themes, countries, entities] = await Promise.all([
    apiFetch<{ themes: [string, number][] }>('/articles/v1/themes'),
    apiFetch<{ countries: [string, number][] }>('/articles/v1/countries'),
    apiFetch<{ entities: [string, number][] }>('/articles/v1/entities?limit=15'),
  ]);

  let html = '';

  // Themes
  html += `<div class="wm-filter-section">
    <h3 class="wm-filter-title">Themes</h3>
    <div class="wm-filter-list">
      ${themes.themes.map(([t, c]) => `
        <button class="wm-filter-chip" data-filter="theme" data-value="${t}">
          <span>${THEME_ICONS[t] || '📄'} ${t}</span>
          <span class="wm-filter-count">${c}</span>
        </button>
      `).join('')}
    </div>
  </div>`;

  // Countries
  if (countries.countries.length > 0) {
    html += `<div class="wm-filter-section">
      <h3 class="wm-filter-title">Countries</h3>
      <div class="wm-filter-list">
        ${countries.countries.slice(0, 20).map(([code, c]) => `
          <button class="wm-filter-chip" data-filter="country" data-value="${code}">
            <span>${COUNTRY_FLAGS[code] || '🌐'} ${code}</span>
            <span class="wm-filter-count">${c}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
  }

  // Threat levels
  html += `<div class="wm-filter-section">
    <h3 class="wm-filter-title">Threat Level</h3>
    <div class="wm-filter-list">
      ${['critical', 'high', 'medium', 'low'].map(t => `
        <button class="wm-filter-chip" data-filter="threat" data-value="${t}">
          <span style="color:${THREAT_COLORS[t]}">● ${t.toUpperCase()}</span>
        </button>
      `).join('')}
    </div>
  </div>`;

  // Entities
  if (entities.entities.length > 0) {
    html += `<div class="wm-filter-section">
      <h3 class="wm-filter-title">Entities</h3>
      <div class="wm-filter-list">
        ${entities.entities.map(([name, c]) => `
          <button class="wm-filter-chip" data-filter="entity" data-value="${name}">
            <span>${name}</span>
            <span class="wm-filter-count">${c}</span>
          </button>
        `).join('')}
      </div>
    </div>`;
  }

  sidebar.innerHTML = html;

  // Wire filter clicks
  sidebar.querySelectorAll('.wm-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = (btn as HTMLElement).dataset.filter as keyof FilterState;
      const value = (btn as HTMLElement).dataset.value!;

      // Toggle
      if (currentFilters[filter] === value) {
        currentFilters[filter] = '';
        btn.classList.remove('active');
      } else {
        // Deactivate other chips in same group
        sidebar.querySelectorAll(`.wm-filter-chip[data-filter="${filter}"]`).forEach(b => b.classList.remove('active'));
        currentFilters[filter] = value;
        btn.classList.add('active');
      }

      updateActiveFilters();
      loadArticles();
    });
  });
}

function updateActiveFilters(): void {
  const container = document.getElementById('active-filters')!;
  const title = document.getElementById('news-view-title')!;

  const active = Object.entries(currentFilters).filter(([_, v]) => v);
  if (active.length === 0) {
    container.innerHTML = '';
    title.textContent = 'All News';
    return;
  }

  title.textContent = 'Filtered';
  container.innerHTML = active.map(([key, val]) => `
    <span class="wm-active-filter">
      ${key}: ${val}
      <button class="wm-filter-remove" data-key="${key}">×</button>
    </span>
  `).join('');

  container.querySelectorAll('.wm-filter-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = (btn as HTMLElement).dataset.key as keyof FilterState;
      currentFilters[key] = '';
      document.querySelectorAll(`.wm-filter-chip[data-filter="${key}"]`).forEach(b => b.classList.remove('active'));
      updateActiveFilters();
      loadArticles();
    });
  });
}

async function loadArticles(): Promise<void> {
  const container = document.getElementById('news-articles')!;
  container.innerHTML = '<div class="wm-loading">Loading articles...</div>';

  const params = new URLSearchParams();
  if (currentFilters.country) params.set('country', currentFilters.country);
  if (currentFilters.theme) params.set('theme', currentFilters.theme);
  if (currentFilters.entity) params.set('entity', currentFilters.entity);
  if (currentFilters.threat) params.set('threat', currentFilters.threat);
  if (currentFilters.source) params.set('source_id', currentFilters.source);
  if (currentFilters.q) params.set('q', currentFilters.q);
  params.set('limit', '100');

  try {
    const data = await apiFetch<{ articles: Article[]; total: number }>(
      `/articles/v1/search?${params}`,
    );

    if (data.articles.length === 0) {
      container.innerHTML = '<div class="wm-news-empty">No articles match your filters</div>';
      return;
    }

    container.innerHTML = '';
    for (const article of data.articles) {
      container.appendChild(renderArticle(article));
    }

    // Result count
    const countEl = document.createElement('div');
    countEl.className = 'wm-news-count';
    countEl.textContent = `${data.total} articles`;
    container.prepend(countEl);
  } catch (err) {
    container.innerHTML = `<div class="wm-error">${err instanceof Error ? err.message : 'Failed to load'}</div>`;
  }
}

function renderArticle(a: Article): HTMLElement {
  const el = document.createElement('a');
  el.className = 'wm-article-card';
  el.href = a.link;
  el.target = '_blank';
  el.rel = 'noopener';

  const threatColor = THREAT_COLORS[a.threat_level] || THREAT_COLORS.info;
  const flag = a.country_codes.map(c => COUNTRY_FLAGS[c] || c).join(' ');
  const themeIcon = THEME_ICONS[a.theme] || '';

  // Time ago
  let timeAgo = '';
  if (a.pub_date) {
    const diff = Date.now() - new Date(a.pub_date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) timeAgo = `${Math.floor(diff / 60000)}m ago`;
    else if (hours < 24) timeAgo = `${hours}h ago`;
    else timeAgo = `${Math.floor(hours / 24)}d ago`;
  }

  el.innerHTML = `
    <div class="wm-article-threat" style="background:${threatColor}"></div>
    <div class="wm-article-content">
      <div class="wm-article-meta">
        <span class="wm-article-source">${a.source_id}</span>
        ${timeAgo ? `<span class="wm-article-time">${timeAgo}</span>` : ''}
        ${a.lang !== 'en' && a.lang !== 'fr' ? `<span class="wm-article-lang">${a.lang}</span>` : ''}
      </div>
      <div class="wm-article-title">${escapeHtml(a.title)}</div>
      ${a.description ? `<div class="wm-article-desc">${escapeHtml(a.description.slice(0, 150))}</div>` : ''}
      <div class="wm-article-tags">
        ${themeIcon ? `<span class="wm-tag wm-tag-theme">${themeIcon} ${a.theme}</span>` : ''}
        ${flag ? `<span class="wm-tag wm-tag-country">${flag}</span>` : ''}
        ${a.entities.slice(0, 3).map(e => `<span class="wm-tag wm-tag-entity">${escapeHtml(e)}</span>`).join('')}
      </div>
    </div>
  `;

  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
