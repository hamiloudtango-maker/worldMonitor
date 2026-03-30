/**
 * Global data provider — single source of truth for articles, stats, entities, countries.
 *
 * Progressive pagination: first page loads instantly, remaining pages
 * stream in the background. Widgets render immediately and enrich as data arrives.
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { api } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';

const PAGE_SIZE = 200;
const MAX_ARTICLES = 2000;

interface GlobalData {
  articles: Article[];
  stats: Stats | null;
  entities: [string, number][];
  countries: [string, number][];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

const DataCtx = createContext<GlobalData | null>(null);

const REFRESH_INTERVAL = 5 * 60_000;

export function DataProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<[string, number][]>([]);
  const [countries, setCountries] = useState<[string, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      // Phase 1: stats + metadata + first page of articles — all in parallel
      const [s, e, c, firstPage] = await Promise.all([
        api<Stats>('/articles/v1/stats'),
        api<{ entities: [string, number][] }>('/articles/v1/entities?limit=30'),
        api<{ countries: [string, number][] }>('/articles/v1/countries'),
        api<{ articles: Article[]; total: number }>(`/articles/v1/search?limit=${PAGE_SIZE}&offset=0`),
      ]);
      setStats(s);
      setEntities(e.entities);
      setCountries(c.countries);
      setArticles(firstPage.articles);
      setLoading(false);

      // Phase 2: remaining pages streamed progressively
      const total = Math.min(firstPage.total, MAX_ARTICLES);
      if (total > PAGE_SIZE) {
        setLoadingMore(true);
        const pages = Math.ceil(total / PAGE_SIZE) - 1;
        for (let i = 0; i < pages; i++) {
          const page = await api<{ articles: Article[] }>(
            `/articles/v1/search?limit=${PAGE_SIZE}&offset=${(i + 1) * PAGE_SIZE}`
          );
          setArticles(prev => [...prev, ...page.articles]);
        }
        setLoadingMore(false);
      }

      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
      setLoading(false);
    }
    busyRef.current = false;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <DataCtx.Provider value={{ articles, stats, entities, countries, loading, loadingMore, error, lastUpdated, refresh }}>
      {children}
    </DataCtx.Provider>
  );
}

export function useGlobalData(): GlobalData {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error('useGlobalData must be inside <DataProvider>');
  return ctx;
}
