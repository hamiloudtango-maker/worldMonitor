/**
 * WorldMonitor OSINT — Shared constants, types, color maps.
 */

// ── Types ─────────────────────────────────────────────────────
export interface Article {
  id: string;
  source_id: string;
  title: string;
  title_translated?: string;
  description: string;
  link: string;
  pub_date: string | null;
  lang: string;
  threat_level: string;
  theme: string;
  confidence: number;
  entities: string[];
  persons: string[];
  organizations: string[];
  country_codes: string[];
}

export interface Stats {
  total: number;
  by_theme: Record<string, number>;
  by_threat: Record<string, number>;
  by_source: Record<string, number>;
  by_lang: Record<string, number>;
  last_ingest_at?: string | null;
}

export interface Filters {
  q: string;
  country: string;
  theme: string;
  entity: string;
  threat: string;
}

export const EMPTY_FILTERS: Filters = { q: '', country: '', theme: '', entity: '', threat: '' };

// ── Theme colors ──────────────────────────────────────────────
export const THEME_COLORS: Record<string, string> = {
  conflict:       '#ef4444',
  military:       '#f97316',
  economic:       '#eab308',
  tech:           '#3b82f6',
  diplomatic:     '#a855f7',
  disaster:       '#06b6d4',
  health:         '#22c55e',
  cyber:          '#14b8a6',
  protest:        '#ec4899',
  crime:          '#78716c',
  environmental:  '#10b981',
  infrastructure: '#6366f1',
  terrorism:      '#dc2626',
  general:        '#6b7280',
};

export const THEME_ICONS: Record<string, string> = {
  conflict:       '\u2694\uFE0F',
  military:       '\uD83C\uDF96\uFE0F',
  economic:       '\uD83D\uDCB0',
  tech:           '\uD83D\uDCBB',
  diplomatic:     '\u2696\uFE0F',
  disaster:       '\uD83C\uDF0A',
  health:         '\uD83C\uDFE5',
  cyber:          '\uD83D\uDEE1\uFE0F',
  protest:        '\u270A',
  crime:          '\uD83D\uDD12',
  environmental:  '\uD83C\uDF3F',
  infrastructure: '\uD83C\uDFD7\uFE0F',
  terrorism:      '\uD83D\uDCA3',
  general:        '\uD83D\uDCC4',
};

// ── Threat levels ─────────────────────────────────────────────
export const THREAT_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
  info:     '#64748b',
};

export const THREAT_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

// ── Country flags ─────────────────────────────────────────────
export const FLAGS: Record<string, string> = {
  US: '\uD83C\uDDFA\uD83C\uDDF8', FR: '\uD83C\uDDEB\uD83C\uDDF7', UA: '\uD83C\uDDFA\uD83C\uDDE6',
  RU: '\uD83C\uDDF7\uD83C\uDDFA', CN: '\uD83C\uDDE8\uD83C\uDDF3', IR: '\uD83C\uDDEE\uD83C\uDDF7',
  IL: '\uD83C\uDDEE\uD83C\uDDF1', DE: '\uD83C\uDDE9\uD83C\uDDEA', GB: '\uD83C\uDDEC\uD83C\uDDE7',
  JP: '\uD83C\uDDEF\uD83C\uDDF5', IN: '\uD83C\uDDEE\uD83C\uDDF3', BR: '\uD83C\uDDE7\uD83C\uDDF7',
  TR: '\uD83C\uDDF9\uD83C\uDDF7', SA: '\uD83C\uDDF8\uD83C\uDDE6', KR: '\uD83C\uDDF0\uD83C\uDDF7',
  AU: '\uD83C\uDDE6\uD83C\uDDFA', CA: '\uD83C\uDDE8\uD83C\uDDE6', KP: '\uD83C\uDDF0\uD83C\uDDF5',
  PS: '\uD83C\uDDF5\uD83C\uDDF8', PH: '\uD83C\uDDF5\uD83C\uDDED', NL: '\uD83C\uDDF3\uD83C\uDDF1',
  ES: '\uD83C\uDDEA\uD83C\uDDF8', IT: '\uD83C\uDDEE\uD83C\uDDF9', PL: '\uD83C\uDDF5\uD83C\uDDF1',
  SE: '\uD83C\uDDF8\uD83C\uDDEA', NO: '\uD83C\uDDF3\uD83C\uDDF4', FI: '\uD83C\uDDEB\uD83C\uDDEE',
  MX: '\uD83C\uDDF2\uD83C\uDDFD', AR: '\uD83C\uDDE6\uD83C\uDDF7', EG: '\uD83C\uDDEA\uD83C\uDDEC',
  NG: '\uD83C\uDDF3\uD83C\uDDEC', ZA: '\uD83C\uDDFF\uD83C\uDDE6', TW: '\uD83C\uDDF9\uD83C\uDDFC',
  SY: '\uD83C\uDDF8\uD83C\uDDFE', IQ: '\uD83C\uDDEE\uD83C\uDDF6', AF: '\uD83C\uDDE6\uD83C\uDDEB',
  SD: '\uD83C\uDDF8\uD83C\uDDE9', YE: '\uD83C\uDDFE\uD83C\uDDEA', LB: '\uD83C\uDDF1\uD83C\uDDE7',
  PK: '\uD83C\uDDF5\uD83C\uDDF0', TH: '\uD83C\uDDF9\uD83C\uDDED', VN: '\uD83C\uDDFB\uD83C\uDDF3',
  MY: '\uD83C\uDDF2\uD83C\uDDFE', ID: '\uD83C\uDDEE\uD83C\uDDE9', MM: '\uD83C\uDDF2\uD83C\uDDF2',
  ET: '\uD83C\uDDEA\uD83C\uDDF9', KE: '\uD83C\uDDF0\uD83C\uDDEA', CO: '\uD83C\uDDE8\uD83C\uDDF4',
};

// ── Helpers ───────────────────────────────────────────────────
export function timeAgo(d: string | null): string {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'à l\u2019instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(d).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}

export function formatSource(sourceId: string): string {
  return sourceId
    .replace(/^gnews_/, '')
    .replace(/^gdelt_/, '')
    .replace(/_all$/, '')
    .replace(/_/g, ' ');
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
