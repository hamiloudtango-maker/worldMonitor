/**
 * Widget catalog — preconfigured widgets for the Add Widget modal.
 * 66 news presets (validated RSS) + 6 data presets (JSON APIs).
 */

import type { FieldDef } from '@/services/template-store';

export interface WidgetPreset {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  defaultSize: { w: number; h: number };
  display: 'feed' | 'table' | 'metric_cards' | 'chart' | 'map_markers';
  sourceType: 'rss' | 'json_api';
  sourceUrl?: string;
  fields: FieldDef[];
  columns: string[];
}

const RSS: FieldDef[] = [
  { name: 'title', path: 'title', type: 'string' },
  { name: 'description', path: 'description', type: 'string' },
  { name: 'link', path: 'link', type: 'url' },
  { name: 'pubDate', path: 'pubDate', type: 'date_iso' },
];

const RSS_COLS = ['title', 'pubDate'];

function rss(id: string, name: string, icon: string, cat: string, desc: string, url: string): WidgetPreset {
  return { id, name, icon, category: cat, description: desc, defaultSize: { w: 4, h: 4 }, display: 'feed', sourceType: 'rss', sourceUrl: url, fields: RSS, columns: RSS_COLS };
}

export const WIDGET_CATALOG: WidgetPreset[] = [
  // ===== INTERNATIONAL ENGLISH =====
  rss('bbc-world', 'BBC World', '📰', 'international', 'BBC World News', 'https://feeds.bbci.co.uk/news/world/rss.xml'),
  rss('guardian', 'Guardian', '📰', 'international', 'The Guardian world news', 'https://www.theguardian.com/world/rss'),
  rss('aljazeera', 'Al Jazeera', '📰', 'international', 'Al Jazeera English', 'https://www.aljazeera.com/xml/rss/all.xml'),
  rss('cnn-world', 'CNN World', '📰', 'international', 'CNN international edition', 'http://rss.cnn.com/rss/edition_world.rss'),
  rss('nyt-world', 'New York Times', '📰', 'international', 'NYT World news', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'),
  rss('wapo-world', 'Washington Post', '📰', 'international', 'WaPo World section', 'https://feeds.washingtonpost.com/rss/world'),
  rss('wsj-world', 'Wall Street Journal', '📰', 'international', 'WSJ World news', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml'),
  rss('sky-news', 'Sky News', '📰', 'international', 'Sky News world', 'https://feeds.skynews.com/feeds/rss/world.xml'),
  rss('independent', 'The Independent', '📰', 'international', 'Independent world news', 'https://www.independent.co.uk/news/world/rss'),
  rss('euronews', 'Euronews', '📰', 'international', 'Euronews latest', 'https://www.euronews.com/rss'),
  rss('france24-en', 'France 24 EN', '📰', 'international', 'France 24 English', 'https://www.france24.com/en/rss'),
  rss('dw-en', 'DW News', '📰', 'international', 'Deutsche Welle English', 'https://rss.dw.com/xml/rss-en-all'),
  rss('middle-east-eye', 'Middle East Eye', '📰', 'international', 'Middle East coverage', 'https://www.middleeasteye.net/rss'),
  rss('times-israel', 'Times of Israel', '📰', 'international', 'Israel & Middle East', 'https://www.timesofisrael.com/feed/'),
  rss('jerusalem-post', 'Jerusalem Post', '📰', 'international', 'Israel news', 'https://www.jpost.com/rss/rssfeedsfrontpage.aspx'),
  rss('moscow-times', 'Moscow Times', '📰', 'international', 'Russia news in English', 'https://www.themoscowtimes.com/rss/news'),

  // ===== US =====
  rss('npr', 'NPR', '🇺🇸', 'us', 'NPR top stories', 'https://feeds.npr.org/1001/rss.xml'),
  rss('cbs-news', 'CBS News', '🇺🇸', 'us', 'CBS latest news', 'https://www.cbsnews.com/latest/rss/main'),
  rss('nbc-news', 'NBC News', '🇺🇸', 'us', 'NBC News latest', 'https://feeds.nbcnews.com/nbcnews/public/news'),
  rss('fox-news', 'Fox News', '🇺🇸', 'us', 'Fox News world', 'https://moxie.foxnews.com/google-publisher/world.xml'),
  rss('pbs', 'PBS NewsHour', '🇺🇸', 'us', 'PBS headlines', 'https://www.pbs.org/newshour/feeds/rss/headlines'),
  rss('politico', 'Politico', '🇺🇸', 'us', 'US politics', 'https://rss.politico.com/politics-news.xml'),
  rss('the-hill', 'The Hill', '🇺🇸', 'us', 'Congress & policy', 'https://thehill.com/feed/'),
  rss('axios', 'Axios', '🇺🇸', 'us', 'Smart brevity news', 'https://api.axios.com/feed/'),

  // ===== FRENCH =====
  rss('lemonde', 'Le Monde', '🇫🇷', 'french', 'Le Monde une', 'https://www.lemonde.fr/rss/une.xml'),
  rss('lefigaro', 'Le Figaro', '🇫🇷', 'french', 'Le Figaro actualités', 'https://www.lefigaro.fr/rss/figaro_actualites.xml'),
  rss('franceinfo', 'France Info', '🇫🇷', 'french', 'France Info titres', 'https://www.francetvinfo.fr/titres.rss'),
  rss('rfi', 'RFI', '🇫🇷', 'french', 'Radio France Internationale', 'https://www.rfi.fr/fr/rss'),
  rss('20minutes', '20 Minutes', '🇫🇷', 'french', '20 Minutes une', 'https://www.20minutes.fr/feeds/rss-une.xml'),
  rss('france24-fr', 'France 24 FR', '🇫🇷', 'french', 'France 24 en français', 'https://www.france24.com/fr/rss'),
  rss('bfmtv', 'BFM TV', '🇫🇷', 'french', 'BFM TV 24/7', 'https://www.bfmtv.com/rss/news-24-7/'),

  // ===== GERMAN =====
  rss('tagesschau', 'Tagesschau', '🇩🇪', 'german', 'ARD Tagesschau', 'https://www.tagesschau.de/index~rss2.xml'),
  rss('spiegel', 'Spiegel', '🇩🇪', 'german', 'Der Spiegel Schlagzeilen', 'https://www.spiegel.de/schlagzeilen/index.rss'),
  rss('zeit', 'Die Zeit', '🇩🇪', 'german', 'Zeit Online', 'https://newsfeed.zeit.de/index'),
  rss('faz', 'FAZ', '🇩🇪', 'german', 'Frankfurter Allgemeine', 'https://www.faz.net/rss/aktuell/'),
  rss('sueddeutsche', 'Süddeutsche', '🇩🇪', 'german', 'SZ Topthemen', 'https://rss.sueddeutsche.de/rss/Topthemen'),
  rss('nzz', 'NZZ', '🇨🇭', 'german', 'Neue Zürcher Zeitung', 'https://www.nzz.ch/recent.rss'),
  rss('stern', 'Stern', '🇩🇪', 'german', 'Stern Nachrichten', 'https://www.stern.de/feed/standard/all/'),

  // ===== SPANISH =====
  rss('elpais', 'El País', '🇪🇸', 'spanish', 'El País portada', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada'),
  rss('elmundo', 'El Mundo', '🇪🇸', 'spanish', 'El Mundo portada', 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml'),
  rss('bbc-mundo', 'BBC Mundo', '🇪🇸', 'spanish', 'BBC en español', 'https://feeds.bbci.co.uk/mundo/rss.xml'),
  rss('abc-espana', 'ABC España', '🇪🇸', 'spanish', 'ABC portada', 'https://www.abc.es/rss/feeds/abcPortada.xml'),

  // ===== ITALIAN =====
  rss('ansa', 'ANSA', '🇮🇹', 'italian', 'ANSA agenzia', 'https://www.ansa.it/sito/ansait_rss.xml'),
  rss('corriere', 'Corriere della Sera', '🇮🇹', 'italian', 'Corriere homepage', 'https://xml2.corriereobjects.it/rss/homepage.xml'),
  rss('repubblica', 'La Repubblica', '🇮🇹', 'italian', 'Repubblica homepage', 'https://www.repubblica.it/rss/homepage/rss2.0.xml'),

  // ===== ARABIC =====
  rss('bbc-arabic', 'BBC Arabic', '🌍', 'arabic', 'BBC عربي', 'https://feeds.bbci.co.uk/arabic/rss.xml'),

  // ===== DUTCH =====
  rss('nos', 'NOS', '🇳🇱', 'dutch', 'NOS Nieuws', 'https://feeds.nos.nl/nosnieuwsalgemeen'),
  rss('nrc', 'NRC', '🇳🇱', 'dutch', 'NRC Handelsblad', 'https://www.nrc.nl/rss/'),

  // ===== SWEDISH =====
  rss('svt', 'SVT Nyheter', '🇸🇪', 'swedish', 'SVT Swedish news', 'https://www.svt.se/nyheter/rss.xml'),

  // ===== TURKISH =====
  rss('bbc-turkce', 'BBC Türkçe', '🇹🇷', 'turkish', 'BBC Türkçe', 'https://feeds.bbci.co.uk/turkce/rss.xml'),
  rss('dw-turkish', 'DW Türkçe', '🇹🇷', 'turkish', 'Deutsche Welle Türkçe', 'https://rss.dw.com/xml/rss-tur-all'),
  rss('hurriyet', 'Hürriyet', '🇹🇷', 'turkish', 'Hürriyet anasayfa', 'https://www.hurriyet.com.tr/rss/anasayfa'),

  // ===== PORTUGUESE =====
  rss('folha', 'Folha de São Paulo', '🇧🇷', 'portuguese', 'Folha mundo', 'https://feeds.folha.uol.com.br/mundo/rss091.xml'),
  rss('bbc-brasil', 'BBC Brasil', '🇧🇷', 'portuguese', 'BBC em português', 'https://feeds.bbci.co.uk/portuguese/rss.xml'),

  // ===== JAPANESE =====
  rss('nhk', 'NHK World', '🇯🇵', 'japanese', 'NHK latest news', 'https://www3.nhk.or.jp/rss/news/cat0.xml'),
  rss('japan-times', 'Japan Times', '🇯🇵', 'japanese', 'Japan Times', 'https://www.japantimes.co.jp/feed/'),

  // ===== INDIAN =====
  rss('ndtv', 'NDTV', '🇮🇳', 'indian', 'NDTV top stories', 'https://feeds.feedburner.com/ndtvnews-top-stories'),
  rss('times-india', 'Times of India', '🇮🇳', 'indian', 'TOI top stories', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'),
  rss('the-hindu', 'The Hindu', '🇮🇳', 'indian', 'The Hindu news', 'https://www.thehindu.com/feeder/default.rss'),
  rss('indian-express', 'Indian Express', '🇮🇳', 'indian', 'Indian Express', 'https://indianexpress.com/feed/'),

  // ===== TECH & BUSINESS =====
  rss('techcrunch', 'TechCrunch', '💻', 'tech', 'Startup & tech news', 'https://techcrunch.com/feed/'),
  rss('arstechnica', 'Ars Technica', '💻', 'tech', 'Tech deep dives', 'https://feeds.arstechnica.com/arstechnica/index'),
  rss('the-verge', 'The Verge', '💻', 'tech', 'Tech & culture', 'https://www.theverge.com/rss/index.xml'),
  rss('wired', 'Wired', '💻', 'tech', 'Future tech & science', 'https://www.wired.com/feed/rss'),
  rss('cnbc', 'CNBC', '💹', 'tech', 'Business & markets', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114'),
  rss('marketwatch', 'MarketWatch', '💹', 'tech', 'Market news', 'https://feeds.marketwatch.com/marketwatch/topstories/'),

  // ===== DATA SOURCES (JSON API) =====
  {
    id: 'usgs-earthquakes', name: 'USGS Earthquakes', icon: '🌍', category: 'data',
    description: 'Significant earthquakes this month', defaultSize: { w: 6, h: 4 },
    display: 'map_markers', sourceType: 'json_api',
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
    id: 'coingecko-top10', name: 'Crypto Top 10', icon: '📈', category: 'data',
    description: 'Top cryptocurrencies by market cap', defaultSize: { w: 4, h: 3 },
    display: 'table', sourceType: 'json_api',
    sourceUrl: 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1',
    fields: [
      { name: 'name', path: 'name', type: 'string' },
      { name: 'price', path: 'current_price', type: 'number' },
      { name: 'market_cap', path: 'market_cap', type: 'number' },
      { name: 'change_24h', path: 'price_change_percentage_24h', type: 'number' },
    ],
    columns: ['name', 'price', 'market_cap', 'change_24h'],
  },
  {
    id: 'weather-paris', name: 'Weather (Paris)', icon: '🌤️', category: 'data',
    description: 'Current weather conditions', defaultSize: { w: 3, h: 2 },
    display: 'metric_cards', sourceType: 'json_api',
    sourceUrl: 'https://api.open-meteo.com/v1/forecast?latitude=48.85&longitude=2.35&current=temperature_2m,wind_speed_10m,relative_humidity_2m',
    fields: [
      { name: 'temperature', path: '$.current.temperature_2m', type: 'number' },
      { name: 'wind', path: '$.current.wind_speed_10m', type: 'number' },
      { name: 'humidity', path: '$.current.relative_humidity_2m', type: 'number' },
    ],
    columns: ['temperature', 'wind', 'humidity'],
  },
  {
    id: 'safecast-radiation', name: 'Radiation (Tokyo)', icon: '☢️', category: 'data',
    description: 'Safecast radiation measurements', defaultSize: { w: 4, h: 3 },
    display: 'map_markers', sourceType: 'json_api',
    sourceUrl: 'https://api.safecast.org/measurements.json?distance=1000&latitude=35.6762&longitude=139.6503&per_page=10',
    fields: [
      { name: 'value', path: 'value', type: 'number' },
      { name: 'unit', path: 'unit', type: 'string' },
      { name: 'lat', path: 'latitude', type: 'geo_lat' },
      { name: 'lon', path: 'longitude', type: 'geo_lon' },
    ],
    columns: ['value', 'unit'],
  },
  {
    id: 'worldbank-gdp', name: 'US GDP', icon: '💹', category: 'data',
    description: 'US GDP from World Bank', defaultSize: { w: 4, h: 3 },
    display: 'chart', sourceType: 'json_api',
    sourceUrl: 'https://api.worldbank.org/v2/country/US/indicator/NY.GDP.MKTP.CD?format=json&per_page=10',
    fields: [
      { name: 'year', path: 'date', type: 'string' },
      { name: 'gdp', path: 'value', type: 'number' },
    ],
    columns: ['year', 'gdp'],
  },
  // Custom source (no URL — user provides it)
  {
    id: 'custom-source', name: 'Custom Source', icon: '➕', category: 'custom',
    description: 'Add any RSS or JSON API URL', defaultSize: { w: 4, h: 3 },
    display: 'table', sourceType: 'json_api', fields: [], columns: [],
  },
];

export function getWidgetsByCategory(): Record<string, WidgetPreset[]> {
  const grouped: Record<string, WidgetPreset[]> = {};
  for (const w of WIDGET_CATALOG) {
    (grouped[w.category] ??= []).push(w);
  }
  return grouped;
}
