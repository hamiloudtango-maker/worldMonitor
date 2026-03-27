// src/v2/hooks/useArticleReader.ts
import { createContext, useContext } from 'react';

type OpenArticle = (articleId: string) => void;

export const ArticleReaderContext = createContext<OpenArticle>(() => {});

export function useArticleReader(): OpenArticle {
  return useContext(ArticleReaderContext);
}
