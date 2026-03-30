// src/v2/lib/ai-feeds-api.ts
import { api } from '@/v2/lib/api';

// ── Types ────────────────────────────────────────────────────
export interface QueryPart {
  type: 'topic' | 'entity' | 'keyword';
  value: string;
  aliases?: string[];
  scope: 'title_and_content' | 'title';
}

export interface QueryLayer {
  operator: 'AND' | 'OR' | 'NOT';
  parts: QueryPart[];
}

export interface ModelLayerDef {
  operator: 'OR' | 'AND' | 'NOT';
  model_ids: string[];
}

export interface FeedQuery {
  layers: QueryLayer[];
  model_layers?: ModelLayerDef[];
}

export interface AIConfig {
  relevance_threshold: number;
  enrichment_enabled: boolean;
  summary_enabled: boolean;
}

export interface AIFeedData {
  id: string;
  name: string;
  description: string | null;
  query: FeedQuery | null;
  ai_config: AIConfig | null;
  status: string;
  is_template: boolean;
  source_count: number;
  result_count: number;
  created_at: string;
  updated_at: string;
}

export interface AIFeedSourceData {
  id: string;
  url: string;
  name: string;
  lang: string | null;
  tier: number;
  source_type: string | null;
  country: string | null;
  continent: string | null;
  origin: string;
  enabled: boolean;
}

export interface AIFeedArticle {
  id: string;
  article_url: string;
  title: string;
  source_name: string;
  published_at: string | null;
  relevance_score: number;
  entities: string[] | null;
  summary: string | null;
  threat_level: string | null;
  category: string | null;
  fetched_at: string;
}

export interface CatalogSource {
  name: string;
  url: string;
  lang: string | null;
  tier: number;
  source_type: string | null;
  country: string | null;
  continent: string | null;
  tags: string[];
}

// ── Feed CRUD ────────────────────────────────────────────────
export function listFeeds(): Promise<{ feeds: AIFeedData[] }> {
  return api('/ai-feeds');
}

export function getFeed(id: string): Promise<AIFeedData> {
  return api(`/ai-feeds/${id}`);
}

export function refreshFeed(id: string): Promise<{ inserted: number; total_results: number }> {
  return api(`/ai-feeds/${id}/refresh`, { method: 'POST' });
}

export function createFeed(data: {
  name: string;
  description?: string;
  query?: FeedQuery;
  ai_config?: Partial<AIConfig>;
}): Promise<AIFeedData> {
  return api('/ai-feeds', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateFeed(id: string, data: Record<string, unknown>): Promise<AIFeedData> {
  return api(`/ai-feeds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteFeed(id: string): Promise<{ status: string }> {
  return api(`/ai-feeds/${id}`, { method: 'DELETE' });
}

// ── Sources ──────────────────────────────────────────────────
export function listFeedSources(feedId: string): Promise<{ sources: AIFeedSourceData[] }> {
  return api(`/ai-feeds/${feedId}/sources`);
}

export function addFeedSource(feedId: string, source: {
  url: string; name: string; lang?: string; tier?: number;
  source_type?: string; country?: string; continent?: string; origin?: string;
}): Promise<AIFeedSourceData> {
  return api(`/ai-feeds/${feedId}/sources`, {
    method: 'POST',
    body: JSON.stringify(source),
  });
}

export function removeFeedSource(feedId: string, sourceId: string): Promise<void> {
  return api(`/ai-feeds/${feedId}/sources/${sourceId}`, { method: 'DELETE' });
}

export function toggleFeedSource(feedId: string, sourceId: string, enabled: boolean): Promise<AIFeedSourceData> {
  return api(`/ai-feeds/${feedId}/sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

// ── Articles ─────────────────────────────────────────────────
export function listFeedArticles(feedId: string, params?: {
  limit?: number; offset?: number;
}): Promise<{ articles: AIFeedArticle[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return api(`/ai-feeds/${feedId}/articles${qs ? `?${qs}` : ''}`);
}

// ── Catalog ──────────────────────────────────────────────────
export function listCatalog(filters?: {
  country?: string; continent?: string; tag?: string; lang?: string; q?: string;
}): Promise<{ sources: CatalogSource[]; total: number }> {
  const q = new URLSearchParams();
  if (filters?.country) q.set('country', filters.country);
  if (filters?.continent) q.set('continent', filters.continent);
  if (filters?.tag) q.set('tag', filters.tag);
  if (filters?.lang) q.set('lang', filters.lang);
  if (filters?.q) q.set('q', filters.q);
  const qs = q.toString();
  return api(`/ai-feeds/catalog/sources${qs ? `?${qs}` : ''}`);
}

// ── AI Bootstrap ─────────────────────────────────────────────
export interface BootstrapResult {
  query: FeedQuery;
  suggested_sources: string[];
  resolved_sources: CatalogSource[];
  description: string;
  error?: string;
}

// ── AI Suggest (batch category tree) ────────────────────────
export interface CategoryLeaf {
  label: string;
  description?: string;
  keywords_strong: string[];
  keywords_weak: string[];
}

export interface CategoryL2 {
  label: string;
  description?: string;
  keywords_strong: string[];
  keywords_weak: string[];
  children: CategoryLeaf[];
}

export interface CategoryL1 {
  label: string;
  keywords_strong: string[];
  keywords_weak: string[];
  children: CategoryL2[];
}

export function fetchCategoryTree(tab: string): Promise<{ categories: CategoryL1[]; error?: string }> {
  return api('/ai-feeds/ai/suggest', {
    method: 'POST',
    body: JSON.stringify({ tab }),
  });
}

// ── Live Preview (before saving) ────────────────────────────
export interface PreviewArticle {
  id: string;
  title: string;
  article_url: string;
  source_name: string;
  published_at: string | null;
  summary: string;
}

export function previewQuery(query: FeedQuery): Promise<{ articles: PreviewArticle[]; total: number }> {
  return api('/ai-feeds/preview', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export function fetchLeaves(params: {
  tab: string; l1: string; l2: string; l2_keywords_strong: string[];
}): Promise<{ children: CategoryLeaf[]; error?: string }> {
  return api('/ai-feeds/ai/suggest-leaves', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Catalog bulk-add ────────────────────────────────────────
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

export function bootstrapFeed(name: string, description?: string): Promise<BootstrapResult> {
  return api('/ai-feeds/ai/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function generateAliases(term: string, type: string = 'keyword'): Promise<{ aliases: string[] }> {
  return api('/ai-feeds/ai/aliases', {
    method: 'POST',
    body: JSON.stringify({ term, type }),
  });
}

// ── Intel Models ─────────────────────────────────────────────
export interface IntelModelData {
  id: string;
  name: string;
  aliases: string[];
  description: string | null;
  article_count: number;
}

export interface IntelSection {
  name: string;
  aliases: string[];
  models: IntelModelData[];
}

export interface IntelFamily {
  key: string;
  label: string;
  aliases: string[];
  sections: IntelSection[];
}

export function fetchIntelTree(): Promise<{ families: IntelFamily[] }> {
  return api('/ai-feeds/intel-models/tree');
}

export function resolveIntelModel(term: string): Promise<{ model: IntelModelData & { family: string; section: string }; created: boolean }> {
  return api('/ai-feeds/intel-models/resolve', {
    method: 'POST',
    body: JSON.stringify({ term }),
  });
}

export function validateUrl(url: string): Promise<{
  valid: boolean; feeds_found: { url: string; title: string }[]; error?: string;
}> {
  return api('/ai-feeds/catalog/validate-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
