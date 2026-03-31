/**
 * WorldMonitor OSINT — API client with JWT auth.
 */

export const API_BASE = 'http://localhost:8000/api';

// ── Token management ──────────────────────────────────────────
const TOKEN_KEY = 'wm-access-token';
const REFRESH_KEY = 'wm-refresh-token';

export function getAccessToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_KEY) ?? '';
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ── Typed fetch wrapper ───────────────────────────────────────
// Token refresh lock: ensures only one refresh happens at a time.
// Concurrent 401s share the same refresh promise instead of racing.
let _refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = _doRefresh();
  try { return await _refreshPromise; } finally { _refreshPromise = null; }
}

async function _doRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    const data = await r.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts?.headers as Record<string, string>),
  };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts?.body && typeof opts.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  let r = await fetch(`${API_BASE}${path}`, { ...opts, headers, cache: 'no-store' as RequestCache });

  // Auto-refresh on 401
  if (r.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      r = await fetch(`${API_BASE}${path}`, { ...opts, headers, cache: 'no-store' as RequestCache });
    }
  }

  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(body || `HTTP ${r.status}`);
  }
  return r.json();
}

// ── Auth endpoints ────────────────────────────────────────────
export async function login(email: string, password: string) {
  const data = await api<{ access_token: string; refresh_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function register(email: string, password: string, orgName: string) {
  const data = await api<{ access_token: string; refresh_token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, org_name: orgName }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(): Promise<{ email: string; org_name: string }> {
  return api('/auth/me');
}

// ── Fetch articles filtered by Intel Model IDs (backend JOIN) ──
export async function fetchArticlesByModels(modelIds: string[], maxArticles: number = 2000): Promise<{ articles: import('@/v2/lib/constants').Article[]; total: number }> {
  if (!modelIds.length) return { articles: [], total: 0 };
  const modelsParam = `models=${modelIds.join(',')}`;
  const PAGE = 500;
  const first = await api<{ articles: import('@/v2/lib/constants').Article[]; total: number }>(
    `/articles/v1/search?limit=${PAGE}&offset=0&${modelsParam}`
  );
  const all = [...first.articles];
  const total = Math.min(first.total, maxArticles);
  if (total > PAGE) {
    const pages = Math.ceil(total / PAGE) - 1;
    const fetches = Array.from({ length: pages }, (_, i) =>
      api<{ articles: import('@/v2/lib/constants').Article[] }>(
        `/articles/v1/search?limit=${PAGE}&offset=${(i + 1) * PAGE}&${modelsParam}`
      )
    );
    const results = await Promise.all(fetches);
    for (const r of results) all.push(...r.articles);
  }
  return { articles: all, total };
}

// ── Fetch all articles (paginated) ───────────────────────────
export async function fetchAllArticles(params: string = '', maxArticles: number = 2000): Promise<import('@/v2/lib/constants').Article[]> {
  const PAGE = 500;
  const first = await api<{ articles: import('@/v2/lib/constants').Article[]; total: number }>(
    `/articles/v1/search?limit=${PAGE}&offset=0${params ? `&${params}` : ''}`
  );
  const all = [...first.articles];
  const total = Math.min(first.total, maxArticles);
  // Fetch remaining pages in parallel
  if (total > PAGE) {
    const pages = Math.ceil(total / PAGE) - 1;
    const fetches = Array.from({ length: pages }, (_, i) =>
      api<{ articles: import('@/v2/lib/constants').Article[] }>(
        `/articles/v1/search?limit=${PAGE}&offset=${(i + 1) * PAGE}${params ? `&${params}` : ''}`
      )
    );
    const results = await Promise.all(fetches);
    for (const r of results) all.push(...r.articles);
  }
  return all;
}

import type { FeedQuery } from './ai-feeds-api';

// ── Case types ───────────────────────────────────────────────
export interface IdentityCard {
  name: string;
  description: string;
  headquarters?: string;
  sector?: string;
  country_code?: string;
  founded?: string;
  website?: string;
  key_people?: string[];
}

export interface CaseData {
  id: string;
  name: string;
  type: string;
  search_keywords: string;
  query: FeedQuery | null;
  identity_card: Record<string, any> | null;
  status: string;
  article_count: number;
  alert_count: number;
  created_at: string;
  updated_at: string;
}

export interface CaseStats {
  total: number;
  by_threat: Record<string, number>;
  by_theme: Record<string, number>;
  by_source?: Record<string, number>;
}

export interface BoardLayout {
  case_id: string;
  layout: unknown[];
}

// ── Cases API ────────────────────────────────────────────────
export async function listCases(): Promise<CaseData[]> {
  const res = await api<any>('/cases');
  return Array.isArray(res) ? res : res.cases ?? [];
}

export function createCase(name: string, type: string, description?: string): Promise<CaseData> {
  return api<CaseData>('/cases', {
    method: 'POST',
    body: JSON.stringify({ name, type, description: description || '' }),
  });
}

export function getCase(id: string): Promise<CaseData> {
  return api<CaseData>(`/cases/${id}`);
}

export function updateCase(id: string, data: Record<string, any>): Promise<CaseData> {
  return api<CaseData>(`/cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteCase(id: string): Promise<void> {
  return api<void>(`/cases/${id}`, { method: 'DELETE' });
}

export async function getCaseArticles(id: string, params?: { limit?: number; offset?: number; threat?: string }): Promise<{ articles: import('@/v2/lib/constants').Article[]; total: number }> {
  const PAGE = params?.limit || 200;
  const q = new URLSearchParams();
  q.set('limit', String(PAGE));
  q.set('offset', '0');
  if (params?.threat) q.set('threat', params.threat);

  const first = await api<{ articles: import('@/v2/lib/constants').Article[]; total: number }>(`/cases/${id}/articles?${q.toString()}`);
  const all = [...first.articles];
  const total = first.total;

  if (total > PAGE) {
    const pages = Math.ceil(total / PAGE) - 1;
    const fetches = Array.from({ length: pages }, (_, i) => {
      const pq = new URLSearchParams(q);
      pq.set('offset', String((i + 1) * PAGE));
      return api<{ articles: import('@/v2/lib/constants').Article[] }>(`/cases/${id}/articles?${pq.toString()}`);
    });
    const results = await Promise.all(fetches);
    for (const r of results) all.push(...r.articles);
  }
  return { articles: all, total };
}

export function getCaseStats(id: string): Promise<CaseStats> {
  return api<CaseStats>(`/cases/${id}/stats`);
}

export function getCaseBoard(id: string): Promise<BoardLayout> {
  return api<BoardLayout>(`/cases/${id}/board`);
}

export function updateCaseBoard(id: string, layout: unknown[]): Promise<BoardLayout> {
  return api<BoardLayout>(`/cases/${id}/board`, {
    method: 'PUT',
    body: JSON.stringify({ layout }),
  });
}

export function forceIngestCase(id: string): Promise<{ status: string }> {
  return api<{ status: string }>(`/cases/${id}/ingest`, { method: 'POST' });
}
