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
