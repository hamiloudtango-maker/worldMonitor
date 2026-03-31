// src/v2/lib/sources-api.ts — Unified sources API client
import { api } from '@/v2/lib/api';

export interface DetectedSource {
  type: string;
  config: Record<string, any>;
  name: string;
  icon: string;
  discovered_from?: string;
}

export interface FolderData {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  position: number;
  source_ids: string[];
  source_count: number;
  unread_count: number;
}

export interface ArticleSummary {
  id: string;
  hash: string;
  title: string;
  description: string;
  url: string;
  source_id: string;
  pub_date?: string;
  threat_level?: string;
  theme?: string;
  family?: string;
  section?: string;
  sentiment?: string;
  criticality?: string;
  lang?: string;
  countries: string[];
  tags: string[];
}

// Source detection
export const detectSource = (url: string) =>
  api('/sources/v2/detect', { method: 'POST', body: JSON.stringify({ url }) }) as Promise<DetectedSource>;

export const addSource = (data: { type: string; config: any; name: string; folder_id?: string; tags?: string[]; country?: string; lang?: string }) =>
  api('/sources/v2/add', { method: 'POST', body: JSON.stringify(data) });

// Folders
export const listFolders = () =>
  api('/sources/v2/folders') as Promise<{ folders: FolderData[] }>;

export const createFolder = (data: { name: string; icon?: string; color?: string }) =>
  api('/sources/v2/folders', { method: 'POST', body: JSON.stringify(data) });

export const updateFolder = (id: string, data: Partial<FolderData>) =>
  api(`/sources/v2/folders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteFolder = (id: string) =>
  api(`/sources/v2/folders/${id}`, { method: 'DELETE' });

export const addSourceToFolder = (folderId: string, sourceId: string) =>
  api(`/sources/v2/folders/${folderId}/add-source`, { method: 'POST', body: JSON.stringify({ source_id: sourceId }) });

// Article states
export const markRead = (articleId: string) =>
  api(`/sources/v2/articles/${articleId}/read`, { method: 'POST' });

export const toggleStar = (articleId: string) =>
  api(`/sources/v2/articles/${articleId}/star`, { method: 'POST' });

export const toggleReadLater = (articleId: string) =>
  api(`/sources/v2/articles/${articleId}/read-later`, { method: 'POST' });

export const listStarred = (limit = 50) =>
  api(`/sources/v2/articles/starred?limit=${limit}`) as Promise<{ articles: ArticleSummary[] }>;

export const listReadLater = (limit = 50) =>
  api(`/sources/v2/articles/read-later?limit=${limit}`) as Promise<{ articles: ArticleSummary[] }>;

// Folder articles
export const folderArticles = (folderId: string, opts: { limit?: number; offset?: number; sort?: string } = {}) =>
  api(`/sources/v2/folders/${folderId}/articles?limit=${opts.limit || 50}&offset=${opts.offset || 0}&sort=${opts.sort || 'date'}`) as Promise<{ articles: ArticleSummary[]; total: number }>;

// Trending
export const getTrending = (period = 'day', limit = 20) =>
  api(`/sources/v2/trending?period=${period}&limit=${limit}`) as Promise<{ articles: ArticleSummary[] }>;

// OPML
export const importOpml = (content: string) =>
  api('/sources/v2/import-opml', { method: 'POST', body: JSON.stringify({ content }) });
