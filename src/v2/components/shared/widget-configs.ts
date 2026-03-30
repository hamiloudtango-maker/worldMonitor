/**
 * Widget configurations — data-driven widget definitions.
 * Each widget = renderer type + data source + field mapping.
 * Adding a widget = adding 1 config entry, not 30 lines of JSX.
 */
import type { ListConfig, ChartConfig, GaugeConfig } from './renderers';
import { withLimit } from '@/v2/lib/display-settings';

// ═══════════════════════════════════════════════════════════════
// LIST WIDGETS (price-list, article-list, status-list)
// ═══════════════════════════════════════════════════════════════

export const LIST_WIDGETS: Record<string, ListConfig> = {
  // ── Markets: price lists ──
  etfflows: {
    endpoint: '/market/v1/list-etf-flows',
    fields: [
      { key: 'symbol', position: 'title' },
      { key: 'name', position: 'subtitle' },
      { key: 'price', position: 'value', format: 'price' },
      { key: 'change_pct', position: 'change', format: 'pct' },
    ],
  },
  stockindex: {
    endpoint: '/market/v1/get-country-stock-index?country=US',
    fields: [
      { key: 'name', position: 'title' },
      { key: 'price', position: 'value', format: 'price' },
      { key: 'change_pct', position: 'change', format: 'pct' },
    ],
  },
  globalindex: {
    endpoint: '/market/v1/list-global-indices',
    fields: [
      { key: 'region', position: 'flag', format: 'flag' },
      { key: 'name', position: 'title' },
      { key: 'price', position: 'value', format: 'int' },
      { key: 'change_pct', position: 'change', format: 'pct' },
    ],
  },
  commodities: {
    endpoint: '/market/v1/list-commodity-quotes',
    fields: [
      { key: 'name', position: 'title' },
      { key: 'price', position: 'value', format: 'price' },
      { key: 'change_pct', position: 'change', format: 'pct' },
    ],
  },

  // ── Live sources: status lists ──
  seismology: {
    endpoint: withLimit('/seismology/v1/list-earthquakes?min_magnitude=4&page_size=20'),
    fields: [
      { key: 'magnitude', position: 'title' },
      { key: 'place', position: 'subtitle' },
      { key: 'depth_km', position: 'value', format: 'int' },
    ],
  },
  maritime: {
    endpoint: withLimit('/maritime/v1/list-navigational-warnings?page_size=15'),
    fields: [
      { key: 'area', position: 'title' },
      { key: 'text', position: 'subtitle' },
      { key: 'authority', position: 'value' },
    ],
    maxItems: 15,
  },
  natural: {
    endpoint: withLimit('/natural/v1/list-natural-events?limit=20'),
    fields: [
      { key: 'category_title', position: 'badge' },
      { key: 'title', position: 'title' },
    ],
  },
  aviation: {
    endpoint: withLimit('/aviation/v1/list-aviation-news?page_size=15'),
    fields: [
      { key: 'title', position: 'title' },
    ],
    linkField: 'link',
  },
  minerals: {
    endpoint: '/supply-chain/v1/get-critical-minerals',
    fields: [
      { key: 'mineral', position: 'title' },
      { key: 'risk_rating', position: 'badge', badgeColors: {
        high: 'bg-red-50 text-red-600', medium: 'bg-amber-50 text-amber-600', low: 'bg-emerald-50 text-emerald-600',
      }},
    ],
  },

  // ── Research / Veille ──
  hackernews: {
    endpoint: withLimit('/research/v1/list-hackernews-items?page_size=20'),
    fields: [
      { key: 'title', position: 'title' },
      { key: 'score', position: 'value', format: 'int' },
    ],
    linkField: 'url',
  },
  predictions: {
    endpoint: withLimit('/prediction/v1/list-prediction-markets?page_size=15'),
    fields: [
      { key: 'title', position: 'title' },
      { key: 'yes_price', position: 'value', format: 'pct' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// CHART WIDGETS
// ═══════════════════════════════════════════════════════════════

export const CHART_WIDGETS: Record<string, ChartConfig> = {
  fredrates: {
    endpoint: withLimit('/economic/v1/get-fred-series?series_id=DGS10&limit=30'),
    dataKey: 'observations',
    xField: 'date',
    xFormat: (d: string) => d.slice(5),
    series: [{ key: 'value', color: '#3b82f6', label: 'Taux' }],
    type: 'area',
    showLabel: 'Taux 10Y US (%)',
  },
  'alert-velocity': {
    endpoint: '/articles/v1/alert-velocity?days=15',
    dataKey: 'days',
    xField: 'date',
    xFormat: (d: string) => d.slice(5),
    series: [
      { key: 'critical', color: '#ef4444', label: 'Critique', stack: '1' },
      { key: 'high', color: '#f97316', label: 'Eleve', stack: '1' },
      { key: 'medium', color: '#eab308', label: 'Moyen', stack: '1' },
    ],
    type: 'area',
  },
};

// ═══════════════════════════════════════════════════════════════
// GAUGE WIDGETS
// ═══════════════════════════════════════════════════════════════

export const GAUGE_WIDGETS: Record<string, GaugeConfig> = {
  feargreed: {
    endpoint: '/market/v1/get-fear-greed-index',
    mode: 'single',
    valueField: 'value',
    labelField: 'classification',
  },
  threats: {
    mode: 'levels',
    statsKey: 'by_threat',
    levels: [
      { key: 'critical', label: 'Critique', color: '#ef4444', description: 'Guerres, attaques majeures, crises nucleaires' },
      { key: 'high', label: 'Eleve', color: '#f97316', description: 'Conflits armes, cyberattaques, sanctions' },
      { key: 'medium', label: 'Moyen', color: '#eab308', description: 'Tensions, exercices militaires, manifestations' },
      { key: 'low', label: 'Faible', color: '#22c55e', description: 'Elections, diplomatie, traites' },
      { key: 'info', label: 'Info', color: '#94a3b8', description: 'Actualites generales sans menace' },
    ],
  },
};
