// src/v2/lib/source-manager-api.ts
import { api } from '@/v2/lib/api';

export interface CatalogSource {
  id: string;
  name: string;
  url: string;
  lang: string | null;
  tier: number;
  source_type: string | null;
  country: string | null;
  continent: string | null;
  tags: string[];
  active: boolean;
  description: string | null;
  origin: string;
  last_fetched_at: string | null;
  fetch_error_count: number;
  status: 'active' | 'degraded' | 'error' | 'disabled';
}

export interface CatalogFilters {
  country?: string;
  continent?: string;
  tag?: string;
  lang?: string;
  status_filter?: string;
  q?: string;
}

export function listSources(filters?: CatalogFilters): Promise<{ sources: CatalogSource[]; total: number }> {
  const q = new URLSearchParams();
  q.set('include_inactive', 'true');
  if (filters?.country) q.set('country', filters.country);
  if (filters?.continent) q.set('continent', filters.continent);
  if (filters?.tag) q.set('tag', filters.tag);
  if (filters?.lang) q.set('lang', filters.lang);
  if (filters?.status_filter) q.set('status_filter', filters.status_filter);
  if (filters?.q) q.set('q', filters.q);
  const qs = q.toString();
  return api(`/ai-feeds/catalog/sources${qs ? `?${qs}` : ''}`);
}

export function updateSource(id: string, data: Partial<CatalogSource>): Promise<CatalogSource> {
  return api(`/ai-feeds/catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteSource(id: string): Promise<{ ok: boolean; action: string }> {
  return api(`/ai-feeds/catalog/${id}`, { method: 'DELETE' });
}

export function bulkAction(ids: string[], action: 'activate' | 'deactivate' | 'delete'): Promise<{ affected: number }> {
  return api('/ai-feeds/catalog/bulk-action', {
    method: 'POST',
    body: JSON.stringify({ ids, action }),
  });
}

export function bulkAddSources(urls: string[]): Promise<{
  added: { url: string; name: string; country?: string; tags?: string[] }[];
  errors: { url: string; error: string }[];
  total_added: number;
}> {
  return api('/ai-feeds/catalog/bulk-add', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });
}
