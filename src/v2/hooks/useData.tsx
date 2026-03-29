/**
 * Global data provider — single source of truth for articles, stats, entities, countries.
 *
 * Eliminates: duplicate fetches (Dashboard/WorldView), inconsistent refresh intervals,
 * silent errors, stale data across views.
 *
 * Usage:
 *   <DataProvider>  in App.tsx (wraps everything)
 *   const { articles, stats, ... } = useGlobalData()  in any component
 */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { api, fetchAllArticles } from '@/v2/lib/api';
import type { Article, Stats } from '@/v2/lib/constants';

interface GlobalData {
  articles: Article[];
  stats: Stats | null;
  entities: [string, number][];
  countries: [string, number][];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

const DataCtx = createContext<GlobalData | null>(null);

const REFRESH_INTERVAL = 5 * 60_000; // 5 min — single interval, not per-view

export function DataProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [entities, setEntities] = useState<[string, number][]>([]);
  const [countries, setCountries] = useState<[string, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const busyRef = useRef(false);
  const firstRef = useRef(true);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (firstRef.current) setLoading(true);
    setError(null);
    try {
      const [s, a, e, c] = await Promise.all([
        api<Stats>('/articles/v1/stats'),
        fetchAllArticles(),
        api<{ entities: [string, number][] }>('/articles/v1/entities?limit=30'),
        api<{ countries: [string, number][] }>('/articles/v1/countries'),
      ]);
      setStats(s);
      setArticles(a);
      setEntities(e.entities);
      setCountries(c.countries);
      setLastUpdated(Date.now());
      firstRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    }
    setLoading(false);
    busyRef.current = false;
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <DataCtx.Provider value={{ articles, stats, entities, countries, loading, error, lastUpdated, refresh }}>
      {children}
    </DataCtx.Provider>
  );
}

export function useGlobalData(): GlobalData {
  const ctx = useContext(DataCtx);
  if (!ctx) throw new Error('useGlobalData must be inside <DataProvider>');
  return ctx;
}
