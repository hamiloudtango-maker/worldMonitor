/**
 * Template store — syncs source templates with the Python backend.
 * Frontend-side cache + CRUD operations via API.
 */

import { apiFetch } from './api-client';

export interface FieldDef {
  name: string;
  path: string;
  type: 'string' | 'number' | 'date_ms' | 'date_iso' | 'geo_lat' | 'geo_lon' | 'url';
}

export interface PanelConfig {
  title: string;
  display: 'feed' | 'table' | 'metric_cards' | 'chart' | 'map_markers';
  columns: string[];
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}

export interface AuthConfig {
  type: 'none' | 'api_key_header' | 'api_key_query' | 'bearer' | 'oauth2_client';
  header_name?: string;
  query_param?: string;
  token_url?: string;
  secret_ref?: string;
}

export interface SourceTemplate {
  source_id: string;
  source_type: 'rss' | 'json_api';
  category: string;
  url: string;
  refresh_seconds: number;
  enabled: boolean;
  namespaces?: Record<string, string>;
  auth?: AuthConfig;
  fields: FieldDef[];
  panel: PanelConfig;
  user_title?: string;
}

export interface TemplateRecord {
  id: string;
  template: SourceTemplate;
  created_at: string;
}

export interface DataResponse {
  source_id: string;
  rows: Record<string, unknown>[];
  row_count: number;
  fetched_at: string;
  cached: boolean;
}

// --- API calls ---

export async function detectSource(url: string): Promise<SourceTemplate> {
  const resp = await apiFetch<{ template: SourceTemplate }>('/sources/v1/detect', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
  return resp.template;
}

export async function validateTemplate(template: SourceTemplate) {
  return apiFetch<{ valid: boolean; row_count: number; sample_row: Record<string, unknown> | null; errors: string[] }>(
    '/sources/v1/validate',
    { method: 'POST', body: JSON.stringify({ template }) },
  );
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  return apiFetch<TemplateRecord[]>('/sources/v1/templates');
}

export async function createTemplate(template: SourceTemplate): Promise<TemplateRecord> {
  return apiFetch<TemplateRecord>('/sources/v1/templates', {
    method: 'POST',
    body: JSON.stringify({ template }),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiFetch(`/sources/v1/templates/${id}`, { method: 'DELETE' });
}

export async function fetchSourceData(sourceId: string): Promise<DataResponse> {
  return apiFetch<DataResponse>(`/sources/v1/data/${sourceId}`);
}

export async function getCatalog() {
  return apiFetch<Array<{
    id: string;
    source_id: string;
    source_type: string;
    category: string;
    url: string;
    panel_config: PanelConfig;
    fields_count: number;
  }>>('/sources/v1/catalog');
}
