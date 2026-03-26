/**
 * Sentiment & analytical KPI computations from real article data.
 */
import type { Article } from './constants';

// ── Types ───────────────────────────────────────────────────────

export interface SentimentBucket {
  time: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  score: number;    // raw score -100..+100
  smoothed: number; // 3-day rolling average
}

export interface CountryRow {
  code: string;
  name: string;
  flag: string;
  total: number;
  political: number;   // diplomatic + protest
  economic: number;     // economic
  military: number;     // conflict + military + terrorism
  social: number;       // health + crime + protest
  geopolitical: number; // weighted threat score
  trend: number;        // recent vs older ratio
}

export interface EntityRow {
  name: string;
  count: number;
  themes: string[];
  threatAvg: number; // 0-1 weighted threat
  trend: number;     // recent vs older
}

export interface VelocityPoint {
  time: string;
  critical: number;
  high: number;
  total: number;
  rate: number; // alerts per hour
}

// ── Helpers ─────────────────────────────────────────────────────

const THREAT_WEIGHT: Record<string, number> = {
  critical: 1.0, high: 0.75, medium: 0.4, low: 0.15, info: 0.05,
};

function rollingAvg(values: number[], window: number): number[] {
  return values.map((_, i, arr) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });
}

import { FLAGS } from './constants';

const COUNTRY_NAMES: Record<string, string> = {
  US: 'Etats-Unis', FR: 'France', UA: 'Ukraine', RU: 'Russie', CN: 'Chine',
  IR: 'Iran', IL: 'Israel', DE: 'Allemagne', GB: 'Royaume-Uni', JP: 'Japon',
  IN: 'Inde', BR: 'Bresil', TR: 'Turquie', SA: 'Arabie Saoudite', KR: 'Coree du Sud',
  AU: 'Australie', CA: 'Canada', KP: 'Coree du Nord', PS: 'Palestine', PH: 'Philippines',
  NL: 'Pays-Bas', ES: 'Espagne', IT: 'Italie', PL: 'Pologne', SE: 'Suede',
  NO: 'Norvege', FI: 'Finlande', MX: 'Mexique', AR: 'Argentine', EG: 'Egypte',
  NG: 'Nigeria', ZA: 'Afrique du Sud', TW: 'Taiwan', SY: 'Syrie', IQ: 'Irak',
  AF: 'Afghanistan', SD: 'Soudan', YE: 'Yemen', LB: 'Liban', PK: 'Pakistan',
  TH: 'Thailande', VN: 'Vietnam', MY: 'Malaisie', ID: 'Indonesie', MM: 'Myanmar',
  ET: 'Ethiopie', KE: 'Kenya', CO: 'Colombie', MN: 'Mongolie',
};

// ── Sentiment by day (smoothed) ─────────────────────────────────

export function computeSentimentByDay(articles: Article[]): SentimentBucket[] {
  const buckets: Record<string, { positive: number; negative: number; neutral: number }> = {};

  for (const a of articles) {
    if (!a.pub_date) continue;
    const d = new Date(a.pub_date);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    if (!buckets[key]) buckets[key] = { positive: 0, negative: 0, neutral: 0 };

    const tl = a.threat_level;
    if (tl === 'critical' || tl === 'high') buckets[key].negative++;
    else if (tl === 'low' || tl === 'info') buckets[key].positive++;
    else buckets[key].neutral++;
  }

  const sorted = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14); // 14 days for 7-day rolling window

  const rawScores = sorted.map(([, b]) => {
    const total = b.positive + b.negative + b.neutral;
    return total > 0 ? Math.round(((b.positive - b.negative) / total) * 100) : 0;
  });
  const smoothed = rollingAvg(rawScores, 3);

  return sorted.slice(-7).map(([date, b], i) => {
    const total = b.positive + b.negative + b.neutral;
    const idx = sorted.length - 7 + i;
    const d = new Date(date);
    return {
      time: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      positive: b.positive,
      negative: b.negative,
      neutral: b.neutral,
      total,
      score: rawScores[idx] ?? 0,
      smoothed: smoothed[idx] ?? 0,
    };
  });
}

// ── Overall sentiment score ─────────────────────────────────────

/**
 * Overall sentiment score 0..100.
 * 0 = all negative, 50 = balanced, 100 = all positive.
 */
export function overallSentimentScore(byThreat: Record<string, number>): number {
  const neg = (byThreat['critical'] || 0) + (byThreat['high'] || 0);
  const pos = (byThreat['low'] || 0) + (byThreat['info'] || 0);
  const total = neg + pos + (byThreat['medium'] || 0);
  if (total === 0) return 50;
  return Math.round(((pos - neg) / total + 1) * 50); // map [-1,1] to [0,100]
}

// ── Country stability matrix ────────────────────────────────────

export function computeCountryMatrix(articles: Article[]): CountryRow[] {
  const now = Date.now();
  const recentCutoff = now - 3 * 24 * 3600 * 1000; // 3 days

  const countries = new Map<string, {
    total: number; recent: number; older: number;
    political: number; economic: number; military: number; social: number;
    threatSum: number;
  }>();

  for (const a of articles) {
    for (const code of a.country_codes) {
      if (!countries.has(code)) {
        countries.set(code, { total: 0, recent: 0, older: 0, political: 0, economic: 0, military: 0, social: 0, threatSum: 0 });
      }
      const c = countries.get(code)!;
      c.total++;

      const isRecent = a.pub_date ? new Date(a.pub_date).getTime() > recentCutoff : false;
      if (isRecent) c.recent++; else c.older++;

      const t = a.theme;
      if (t === 'diplomatic' || t === 'protest') c.political++;
      if (t === 'economic') c.economic++;
      if (t === 'conflict' || t === 'military' || t === 'terrorism') c.military++;
      if (t === 'health' || t === 'crime' || t === 'protest') c.social++;
      c.threatSum += THREAT_WEIGHT[a.threat_level] || 0.2;
    }
  }

  return Array.from(countries.entries())
    .filter(([, c]) => c.total >= 2)
    .map(([code, c]) => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      flag: FLAGS[code] || '',
      total: c.total,
      political: c.total > 0 ? Math.round((c.political / c.total) * 100) : 0,
      economic: c.total > 0 ? Math.round((c.economic / c.total) * 100) : 0,
      military: c.total > 0 ? Math.round((c.military / c.total) * 100) : 0,
      social: c.total > 0 ? Math.round((c.social / c.total) * 100) : 0,
      geopolitical: c.total > 0 ? Math.round((c.threatSum / c.total) * 100) : 0,
      trend: c.older > 0 ? Math.round(((c.recent - c.older) / c.older) * 100) : (c.recent > 0 ? 100 : 0),
    }))
    .sort((a, b) => b.total - a.total);
}

// ── Top entities with trend ─────────────────────────────────────

export function computeTopEntities(articles: Article[]): EntityRow[] {
  const now = Date.now();
  const recentCutoff = now - 3 * 24 * 3600 * 1000;

  const entities = new Map<string, {
    count: number; recent: number; older: number;
    themes: Set<string>; threatSum: number;
  }>();

  for (const a of articles) {
    for (const e of a.entities) {
      if (!e || e.length < 2) continue;
      if (!entities.has(e)) {
        entities.set(e, { count: 0, recent: 0, older: 0, themes: new Set(), threatSum: 0 });
      }
      const row = entities.get(e)!;
      row.count++;
      if (a.theme) row.themes.add(a.theme);
      row.threatSum += THREAT_WEIGHT[a.threat_level] || 0.2;

      const isRecent = a.pub_date ? new Date(a.pub_date).getTime() > recentCutoff : false;
      if (isRecent) row.recent++; else row.older++;
    }
  }

  return Array.from(entities.entries())
    .filter(([, e]) => e.count >= 2)
    .map(([name, e]) => ({
      name,
      count: e.count,
      themes: Array.from(e.themes).slice(0, 3),
      threatAvg: e.count > 0 ? Math.round((e.threatSum / e.count) * 100) / 100 : 0,
      trend: e.older > 0 ? Math.round(((e.recent - e.older) / e.older) * 100) : (e.recent > 0 ? 100 : 0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

// ── Alert velocity (critical+high articles over time) ───────────

export function computeAlertVelocity(articles: Article[]): VelocityPoint[] {
  const buckets: Record<string, { critical: number; high: number; total: number; hours: number }> = {};

  for (const a of articles) {
    if (!a.pub_date) continue;
    const d = new Date(a.pub_date);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    if (!buckets[key]) buckets[key] = { critical: 0, high: 0, total: 0, hours: 24 };

    buckets[key].total++;
    if (a.threat_level === 'critical') buckets[key].critical++;
    if (a.threat_level === 'high') buckets[key].high++;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, b]) => {
      const d = new Date(date);
      return {
        time: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        critical: b.critical,
        high: b.high,
        total: b.total,
        rate: Math.round(((b.critical + b.high) / b.hours) * 100) / 100,
      };
    });
}

// ── Source coverage score ────────────────────────────────────────

export interface SourceCoverage {
  name: string;
  articles: number;
  themes: number;
  countries: number;
  avgThreat: number;
}

export function computeSourceCoverage(articles: Article[]): SourceCoverage[] {
  const sources = new Map<string, {
    count: number; themes: Set<string>; countries: Set<string>; threatSum: number;
  }>();

  for (const a of articles) {
    const src = a.source_id;
    if (!sources.has(src)) {
      sources.set(src, { count: 0, themes: new Set(), countries: new Set(), threatSum: 0 });
    }
    const s = sources.get(src)!;
    s.count++;
    if (a.theme) s.themes.add(a.theme);
    for (const c of a.country_codes) s.countries.add(c);
    s.threatSum += THREAT_WEIGHT[a.threat_level] || 0.2;
  }

  return Array.from(sources.entries())
    .map(([name, s]) => ({
      name: name.replace(/^catalog_|^gnews_|^gdelt_|^case_|^rss_/g, '').replace(/_/g, ' '),
      articles: s.count,
      themes: s.themes.size,
      countries: s.countries.size,
      avgThreat: s.count > 0 ? Math.round((s.threatSum / s.count) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.articles - a.articles)
    .slice(0, 20);
}

// ── Country x Theme heatmap ──────────────────────────────────────

export interface CountryThemeCell {
  code: string;
  name: string;
  flag: string;
  total: number;
  sources: number;
  themes: Record<string, number>; // theme → count
}

export function computeCountryThemeMatrix(articles: Article[]): { rows: CountryThemeCell[]; allThemes: string[] } {
  const countries = new Map<string, { total: number; sources: Set<string>; themes: Map<string, number> }>();

  for (const a of articles) {
    for (const code of a.country_codes) {
      if (!countries.has(code)) {
        countries.set(code, { total: 0, sources: new Set(), themes: new Map() });
      }
      const c = countries.get(code)!;
      c.total++;
      c.sources.add(a.source_id);
      const t = a.theme || 'general';
      c.themes.set(t, (c.themes.get(t) || 0) + 1);
    }
  }

  // Collect all themes across all countries
  const themeSet = new Set<string>();
  for (const [, c] of countries) {
    for (const t of c.themes.keys()) themeSet.add(t);
  }
  const allThemes = Array.from(themeSet).sort();

  const rows: CountryThemeCell[] = Array.from(countries.entries())
    .filter(([, c]) => c.total >= 2)
    .map(([code, c]) => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      flag: FLAGS[code] || '',
      total: c.total,
      sources: c.sources.size,
      themes: Object.fromEntries(c.themes),
    }))
    .sort((a, b) => b.total - a.total);

  return { rows, allThemes };
}

// ── Theme radar data ────────────────────────────────────────────

export interface ThemeRadarPoint {
  theme: string;
  count: number;
  pct: number;
  avgThreat: number;
}

export function computeThemeRadar(articles: Article[]): ThemeRadarPoint[] {
  const themes = new Map<string, { count: number; threatSum: number }>();

  for (const a of articles) {
    const t = a.theme || 'general';
    if (!themes.has(t)) themes.set(t, { count: 0, threatSum: 0 });
    const row = themes.get(t)!;
    row.count++;
    row.threatSum += THREAT_WEIGHT[a.threat_level] || 0.2;
  }

  const total = articles.length || 1;
  return Array.from(themes.entries())
    .map(([theme, t]) => ({
      theme: theme.charAt(0).toUpperCase() + theme.slice(1),
      count: t.count,
      pct: Math.round((t.count / total) * 100),
      avgThreat: t.count > 0 ? Math.round((t.threatSum / t.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}
