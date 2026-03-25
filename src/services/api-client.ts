/**
 * API client for WorldMonitor v2 Python backend.
 * Handles JWT auth, token refresh, and typed requests.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

let accessToken: string | null = localStorage.getItem('wm-access-token');
let refreshToken: string | null = localStorage.getItem('wm-refresh-token');

function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('wm-access-token', access);
  localStorage.setItem('wm-refresh-token', refresh);
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('wm-access-token');
  localStorage.removeItem('wm-refresh-token');
}

export function isAuthenticated(): boolean {
  return accessToken !== null;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  let resp = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Auto-refresh on 401
  if (resp.status === 401 && refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      resp = await fetch(`${API_BASE}${path}`, { ...init, headers });
    }
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${text}`);
  }

  if (resp.status === 204) return undefined as T;
  return resp.json();
}

// --- Auth ---

export async function register(email: string, password: string, orgName: string) {
  const data = await apiFetch<{ access_token: string; refresh_token: string }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify({ email, password, org_name: orgName }) },
  );
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ access_token: string; refresh_token: string }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe() {
  return apiFetch<{ id: string; email: string; role: string; org_id: string; org_name: string }>(
    '/auth/me',
  );
}
