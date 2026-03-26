import { useState, useCallback, useEffect } from 'react';
import { listFeeds, createFeed, deleteFeed, updateFeed } from '@/v2/lib/ai-feeds-api';
import type { AIFeedData, FeedQuery, AIConfig } from '@/v2/lib/ai-feeds-api';

export function useAIFeeds() {
  const [feeds, setFeeds] = useState<AIFeedData[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFeeds();
      setFeeds(data.feeds);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (name: string, description?: string, query?: FeedQuery, ai_config?: Partial<AIConfig>) => {
    const f = await createFeed({ name, description, query, ai_config });
    setFeeds(prev => [f, ...prev]);
    return f;
  }, []);

  const update = useCallback(async (id: string, data: Record<string, unknown>) => {
    const f = await updateFeed(id, data);
    setFeeds(prev => prev.map(x => x.id === id ? f : x));
    return f;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteFeed(id);
    setFeeds(prev => prev.filter(f => f.id !== id));
  }, []);

  return { feeds, loading, reload, add, update, remove };
}
