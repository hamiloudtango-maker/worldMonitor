import { useState, useCallback, useEffect } from 'react';
import { listCases, createCase, deleteCase } from '@/v2/lib/api';
import type { CaseData } from '@/v2/lib/api';

export function useCases() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCases();
      setCases(data);
    } catch {
      /* silent — list may be empty */
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (name: string, type: string) => {
    const c = await createCase(name, type);
    setCases(prev => [c, ...prev]);
    return c;
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteCase(id);
    setCases(prev => prev.filter(c => c.id !== id));
  }, []);

  return { cases, loading, reload, add, remove };
}
