/**
 * Widget catalog — preconfigured widgets available in the "Add Widget" modal.
 * Each widget maps to a source template with proper fields for its source type.
 */

import type { FieldDef } from '@/services/template-store';

export interface WidgetPreset {
  id: string;
  name: string;
  icon: string;
  category: 'news' | 'markets' | 'geo' | 'cyber' | 'climate' | 'economic' | 'custom';
  description: string;
  defaultSize: { w: number; h: number };
  display: 'feed' | 'table' | 'metric_cards' | 'chart' | 'map_markers';
  sourceType: 'rss' | 'json_api';
  sourceUrl?: string;
  fields: FieldDef[];
  columns: string[];
  hardcodedKey?: string;
}

// --- Reusable field sets ---

const RSS_FIELDS: FieldDef[] = [
  { name: 'title', path: 'title', type: 'string' },
  { name: 'description', path: 'description', type: 'string' },
  { name: 'link', path: 'link', type: 'url' },
  { name: 'pubDate', path: 'pubDate', type: 'date_iso' },
];

export const WIDGET_CATALOG: WidgetPreset[] = [
  // --- News (RSS) ---
  {
    id: 'bbc-world',
    name: 'BBC World News',
    icon: '📰',
    category: 'news',
    description: 'Latest headlines from BBC World',
    defaultSize: { w: 4, h: 4 },
    display: 'feed',
    sourceType: 'rss',
    sourceUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    fields: RSS_FIELDS,
    columns: ['title', 'pubDate'],
  },
  {
    id: 'guardian-world',
    name: 'Guardian World',
    icon: '📰',
    category: 'news',
    description: 'The Guardian world news feed',
    defaultSize: { w: 4, h: 4 },
    display: 'feed',
    sourceType: 'rss',
    sourceUrl: 'https://www.theguardian.com/world/rss',
    fields: RSS_FIELDS,
    columns: ['title', 'pubDate'],
  },
  {
    id: 'aljazeera',
    name: 'Al Jazeera',
    icon: '📰',
    category: 'news',
    description: 'Al Jazeera English news feed',
    defaultSize: { w: 4, h: 4 },
    display: 'feed',
    sourceType: 'rss',
    sourceUrl: 'https://www.aljazeera.com/xml/rss/all.xml',
    fields: RSS_FIELDS,
    columns: ['title', 'pubDate'],
  },
  {
    id: 'france24',
    name: 'France 24',
    icon: '📰',
    category: 'news',
    description: 'France 24 English news',
    defaultSize: { w: 4, h: 4 },
    display: 'feed',
    sourceType: 'rss',
    sourceUrl: 'https://www.france24.com/en/rss',
    fields: RSS_FIELDS,
    columns: ['title', 'pubDate'],
  },
  {
    id: 'dw-news',
    name: 'DW News',
    icon: '📰',
    category: 'news',
    description: 'Deutsche Welle English news',
    defaultSize: { w: 4, h: 4 },
    display: 'feed',
    sourceType: 'rss',
    sourceUrl: 'https://rss.dw.com/xml/rss-en-all',
    fields: RSS_FIELDS,
    columns: ['title', 'pubDate'],
  },
  {
    id: 'npr',
    name: 'NPR News',
    icon: '📰',
    category: 'news',
    description: 'NPR top stories',
    defaultSize: { w: 4, h: 4 },
    display: 'feed',
    sourceType: 'rss',
    sourceUrl: 'https://feeds.npr.org/1001/rss.xml',
    fields: RSS_FIELDS,
    columns: ['title', 'pubDate'],
  },

  // --- Geo / Natural disasters (JSON) ---
  {
    id: 'usgs-earthquakes',
    name: 'USGS Earthquakes',
    icon: '🌍',
    category: 'geo',
    description: 'Significant earthquakes this month',
    defaultSize: { w: 6, h: 4 },
    display: 'map_markers',
    sourceType: 'json_api',
    sourceUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
    fields: [
      { name: 'title', path: '$.features[*].properties.title', type: 'string' },
      { name: 'magnitude', path: '$.features[*].properties.mag', type: 'number' },
      { name: 'place', path: '$.features[*].properties.place', type: 'string' },
      { name: 'lat', path: '$.features[*].geometry.coordinates[1]', type: 'geo_lat' },
      { name: 'lon', path: '$.features[*].geometry.coordinates[0]', type: 'geo_lon' },
      { name: 'time', path: '$.features[*].properties.time', type: 'date_ms' },
    ],
    columns: ['title', 'magnitude', 'place'],
  },
  {
    id: 'nasa-eonet',
    name: 'NASA Natural Events',
    icon: '🌍',
    category: 'geo',
    description: 'Active natural events from NASA EONET',
    defaultSize: { w: 6, h: 4 },
    display: 'table',
    sourceType: 'json_api',
    sourceUrl: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=20',
    fields: [
      { name: 'title', path: '$.events[*].title', type: 'string' },
      { name: 'category', path: '$.events[*].categories[0].title', type: 'string' },
      { name: 'date', path: '$.events[*].geometry[0].date', type: 'date_iso' },
    ],
    columns: ['title', 'category', 'date'],
  },
  {
    id: 'safecast-radiation',
    name: 'Radiation (Tokyo)',
    icon: '☢️',
    category: 'geo',
    description: 'Safecast radiation measurements near Tokyo',
    defaultSize: { w: 4, h: 3 },
    display: 'map_markers',
    sourceType: 'json_api',
    sourceUrl: 'https://api.safecast.org/measurements.json?distance=1000&latitude=35.6762&longitude=139.6503&per_page=10',
    fields: [
      { name: 'value', path: 'value', type: 'number' },
      { name: 'unit', path: 'unit', type: 'string' },
      { name: 'lat', path: 'latitude', type: 'geo_lat' },
      { name: 'lon', path: 'longitude', type: 'geo_lon' },
      { name: 'captured_at', path: 'captured_at', type: 'date_iso' },
    ],
    columns: ['value', 'unit'],
  },

  // --- Markets (JSON) ---
  {
    id: 'coingecko-top10',
    name: 'Crypto Top 10',
    icon: '📈',
    category: 'markets',
    description: 'Top 10 cryptocurrencies by market cap',
    defaultSize: { w: 4, h: 3 },
    display: 'table',
    sourceType: 'json_api',
    sourceUrl: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1',
    fields: [
      { name: 'name', path: 'name', type: 'string' },
      { name: 'price', path: 'current_price', type: 'number' },
      { name: 'market_cap', path: 'market_cap', type: 'number' },
      { name: 'change_24h', path: 'price_change_percentage_24h', type: 'number' },
    ],
    columns: ['name', 'price', 'market_cap', 'change_24h'],
  },

  // --- Climate (JSON) ---
  {
    id: 'weather-current',
    name: 'Weather (Paris)',
    icon: '🌤️',
    category: 'climate',
    description: 'Current weather conditions',
    defaultSize: { w: 3, h: 2 },
    display: 'metric_cards',
    sourceType: 'json_api',
    sourceUrl: 'https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m,wind_speed_10m,relative_humidity_2m',
    fields: [
      { name: 'temperature', path: '$.current.temperature_2m', type: 'number' },
      { name: 'wind', path: '$.current.wind_speed_10m', type: 'number' },
      { name: 'humidity', path: '$.current.relative_humidity_2m', type: 'number' },
    ],
    columns: ['temperature', 'wind', 'humidity'],
  },

  // --- Economic (JSON) ---
  {
    id: 'worldbank-gdp',
    name: 'US GDP (World Bank)',
    icon: '💹',
    category: 'economic',
    description: 'US GDP from World Bank API',
    defaultSize: { w: 4, h: 3 },
    display: 'chart',
    sourceType: 'json_api',
    sourceUrl: 'https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.CD?format=json&per_page=10',
    fields: [
      { name: 'year', path: 'date', type: 'string' },
      { name: 'gdp', path: 'value', type: 'number' },
      { name: 'country', path: 'country.value', type: 'string' },
    ],
    columns: ['year', 'gdp'],
  },

  // --- Custom ---
  {
    id: 'custom-source',
    name: 'Custom Source',
    icon: '➕',
    category: 'custom',
    description: 'Add any RSS feed or JSON API by URL',
    defaultSize: { w: 4, h: 3 },
    display: 'table',
    sourceType: 'json_api',
    fields: [],
    columns: [],
  },
];

export function getWidgetsByCategory(): Record<string, WidgetPreset[]> {
  const grouped: Record<string, WidgetPreset[]> = {};
  for (const w of WIDGET_CATALOG) {
    (grouped[w.category] ??= []).push(w);
  }
  return grouped;
}
