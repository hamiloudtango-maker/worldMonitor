/**
 * Display settings — stored in localStorage, used by widgets and views.
 */

export interface DisplayConfig {
  feedArticleLimit: number;
  caseArticleLimit: number;
  widgetArticleLimit: number;
  dashboardArticleLimit: number;
  previewArticleLimit: number;
}

const STORAGE_KEY = 'wm_display_settings';

const DEFAULTS: DisplayConfig = {
  feedArticleLimit: 100,
  caseArticleLimit: 200,
  widgetArticleLimit: 50,
  dashboardArticleLimit: 100,
  previewArticleLimit: 50,
};

export function getDisplaySettings(): DisplayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function setDisplaySettings(config: Partial<DisplayConfig>): DisplayConfig {
  const current = getDisplaySettings();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function getLimit(key: keyof DisplayConfig): number {
  return getDisplaySettings()[key];
}

/**
 * Inject configured limit into any API endpoint URL.
 * Replaces existing limit/page_size/per_page or appends it.
 */
export function withLimit(endpoint: string, key: keyof DisplayConfig = 'widgetArticleLimit'): string {
  const limit = getLimit(key);
  // Replace existing limit params
  let url = endpoint
    .replace(/([?&])limit=\d+/, `$1limit=${limit}`)
    .replace(/([?&])page_size=\d+/, `$1page_size=${limit}`)
    .replace(/([?&])per_page=\d+/, `$1per_page=${limit}`);
  // If no limit param existed, append one
  if (url === endpoint && !url.includes('limit=') && !url.includes('page_size=')) {
    url += (url.includes('?') ? '&' : '?') + `limit=${limit}`;
  }
  return url;
}
