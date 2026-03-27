// src/v2/lib/article-api.ts
import { api } from '@/v2/lib/api';

export interface ArticleContent {
  content_md: string | null;
  url: string;
  title: string;
  source_id?: string;
  error?: string;
  cached: boolean;
}

export function getArticleContent(articleId: string): Promise<ArticleContent> {
  return api(`/articles/v1/${articleId}/content`);
}
