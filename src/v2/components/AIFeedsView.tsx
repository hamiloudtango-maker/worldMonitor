// src/v2/components/AIFeedsView.tsx
import { useState, useCallback } from 'react';
import { useAIFeeds } from '@/v2/hooks/useAIFeeds';
import type { AIFeedData, FeedQuery, AIConfig } from '@/v2/lib/ai-feeds-api';
import { updateFeed as apiFeedUpdate } from '@/v2/lib/ai-feeds-api';
import FeedList from './ai-feeds/FeedList';
import QueryBuilder from './ai-feeds/QueryBuilder';
import SourceSelector from './ai-feeds/SourceSelector';
import FeedPreview from './ai-feeds/FeedPreview';

export default function AIFeedsView() {
  const { feeds, loading, add, remove, update } = useAIFeeds();
  const [selected, setSelected] = useState<AIFeedData | null>(null);
  const [localQuery, setLocalQuery] = useState<FeedQuery>({ layers: [] });
  const [dirty, setDirty] = useState(false);

  function handleSelect(feed: AIFeedData) {
    setSelected(feed);
    setLocalQuery(feed.query || { layers: [] });
    setDirty(false);
  }

  function handleQueryChange(query: FeedQuery) {
    setLocalQuery(query);
    setDirty(true);
  }

  async function handleCreate(name: string) {
    const feed = await add(name);
    handleSelect(feed);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (selected?.id === id) {
      setSelected(null);
      setLocalQuery({ layers: [] });
    }
  }

  async function handleSave() {
    if (!selected || !dirty) return;
    const updated = await update(selected.id, { query: localQuery });
    setSelected(updated);
    setDirty(false);
  }

  return (
    <div className="flex h-full -m-5 bg-white rounded-xl border border-slate-200/60 overflow-hidden">
      {/* Left: Feed list */}
      <FeedList
        feeds={feeds}
        selectedId={selected?.id || null}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onDelete={handleDelete}
      />

      {/* Center: Query builder + Preview */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200/60">
        {selected ? (
          <>
            {/* Feed header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{selected.name}</h2>
                <p className="text-[10px] text-slate-400">
                  {selected.source_count} sources · {selected.result_count} articles · {selected.status}
                </p>
              </div>
              {dirty && (
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 text-[11px] font-semibold text-white rounded-lg shadow-sm transition-colors"
                  style={{ background: '#42d3a5' }}
                >
                  Sauvegarder
                </button>
              )}
            </div>

            {/* Query builder */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <QueryBuilder query={localQuery} onChange={handleQueryChange} />
              <div className="border-t border-slate-100 pt-4">
                <FeedPreview feedId={selected.id} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">AI Feeds</h3>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Créez des thématiques intelligentes pour collecter et filtrer les articles les plus pertinents.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Source selector */}
      <div className="w-80 shrink-0 bg-white">
        <SourceSelector feedId={selected?.id || null} />
      </div>
    </div>
  );
}
