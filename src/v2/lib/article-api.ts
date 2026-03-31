// src/v2/lib/article-api.ts
import { api } from '@/v2/lib/api';

export interface ArticleContent {
  id: string;
  hash: string;
  title: string;
  title_translated?: string;
  description?: string;
  url: string;
  source_id?: string;
  pub_date?: string;
  lang?: string;
  threat_level?: string;
  theme?: string;
  family?: string;
  section?: string;
  article_type?: string;
  criticality?: string;
  sentiment?: string;
  summary?: string;
  tags: string[];
  persons: string[];
  orgs: string[];
  countries: string[];
  countries_mentioned: string[];
  content_md: string | null;
  word_count?: number;
  reading_time_min?: number;
  error?: string;
  cached: boolean;
}

export function getArticleContent(articleId: string): Promise<ArticleContent> {
  return api(`/articles/v1/${articleId}/content`);
}
