// src/v2/components/AIFeedsView.tsx
import { useState } from 'react';
import { useAIFeeds } from '@/v2/hooks/useAIFeeds';
import type { AIFeedData, FeedQuery } from '@/v2/lib/ai-feeds-api';
import { bootstrapFeed, addFeedSource } from '@/v2/lib/ai-feeds-api';
import FeedList from './ai-feeds/FeedList';
import QueryBuilder from './ai-feeds/QueryBuilder';
import SourceSelector from './ai-feeds/SourceSelector';
import FeedPreview from './ai-feeds/FeedPreview';
import FeedCreator from './ai-feeds/FeedCreator';
import RssBulkAdd from './ai-feeds/RssBulkAdd';

export default function AIFeedsView() {
  const { feeds, add, remove, update } = useAIFeeds();
  const [selected, setSelected] = useState<AIFeedData | null>(null);
  const [localQuery, setLocalQuery] = useState<FeedQuery>({ layers: [] });
  const [dirty, setDirty] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [sourceKey, setSourceKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  function handleSelect(feed: AIFeedData) {
    setSelected(feed);
    setLocalQuery(feed.query || { layers: [] });
    setDirty(false);
    setCreating(false);
  }

  function handleQueryChange(query: FeedQuery) {
    setLocalQuery(query);
    setDirty(true);
  }

  function handleStartCreate() {
    setSelected(null);
    setCreating(true);
  }

  async function handleCreateFromWizard(name: string, query: FeedQuery) {
    setBootstrapping(true);
    try {
      const feed = await add(name, '', query);

      // Bootstrap to get AI-suggested sources
      const bootstrap = await bootstrapFeed(name);

      if (bootstrap.resolved_sources?.length && feed.id) {
        const addPromises = bootstrap.resolved_sources.map(s =>
          addFeedSource(feed.id, {
            url: s.url, name: s.name, lang: s.lang ?? undefined,
            tier: s.tier, source_type: s.source_type ?? undefined,
            country: s.country ?? undefined, continent: s.continent ?? undefined,
            origin: 'ai_suggested',
          }).catch(() => null)
        );
        await Promise.all(addPromises);
      }

      if (bootstrap.description) {
        await update(feed.id, { query, description: bootstrap.description });
      }

      setLocalQuery(query);
      setSelected({ ...feed, source_count: bootstrap.resolved_sources?.length || 0 });
      setDirty(false);
      setCreating(false);
      setSourceKey(k => k + 1);
    } catch {
      const feed = await add(name, '', query);
      handleSelect(feed);
    }
    setBootstrapping(false);
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
      {/* Left: Feed list + RSS bulk add */}
      <div className="w-72 border-r border-slate-200/60 bg-white flex flex-col shrink-0">
        <div className="flex-1 overflow-hidden">
          <FeedList
            feeds={feeds}
            selectedId={selected?.id || null}
            bootstrapping={bootstrapping}
            onSelect={handleSelect}
            onCreate={handleStartCreate}
            onDelete={handleDelete}
          />
        </div>
        <RssBulkAdd />
      </div>

      {/* Center + Right: creation wizard or edit view */}
      {creating ? (
        <FeedCreator
          onSave={handleCreateFromWizard}
          onCancel={() => setCreating(false)}
          saving={bootstrapping}
        />
      ) : selected ? (
        <>
          {/* Center: Query builder + Preview */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200/60">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                {editingName ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={async () => {
                      if (editName.trim() && editName.trim() !== selected.name) {
                        const updated = await update(selected.id, { name: editName.trim() });
                        setSelected(updated);
                      }
                      setEditingName(false);
                    }}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    className="text-sm font-bold text-slate-900 bg-transparent border-b border-[#42d3a5] focus:outline-none px-0 py-0"
                  />
                ) : (
                  <h2
                    className="text-sm font-bold text-slate-900 cursor-pointer hover:text-[#42d3a5] transition-colors"
                    onClick={() => { setEditName(selected.name); setEditingName(true); }}
                    title="Cliquer pour renommer"
                  >
                    {selected.name}
                  </h2>
                )}
                <p className="text-[10px] text-slate-400">
                  {selected.source_count} sources · {previewCount || selected.result_count} articles · {selected.status}
                  {selected.description && <span className="ml-1">— {selected.description}</span>}
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
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <QueryBuilder query={localQuery} onChange={handleQueryChange} />
              <div className="border-t border-slate-100 pt-4">
                <FeedPreview feedId={selected.id} query={localQuery} onCountChange={setPreviewCount} />
              </div>
            </div>
          </div>

          {/* Right: Source selector */}
          <div className="w-80 shrink-0 bg-white">
            <SourceSelector key={sourceKey} feedId={selected.id} />
          </div>
        </>
      ) : (
        /* Empty state — prompt to create */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-50 to-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#42d3a5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">AI Feeds</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Créez un feed intelligent pour surveiller les sujets qui comptent. L'IA configure automatiquement vos filtres et sources.
            </p>
            <button
              onClick={handleStartCreate}
              className="px-4 py-2 text-[12px] font-semibold text-white rounded-lg bg-[#42d3a5] hover:bg-[#38b891] transition-colors"
            >
              Créer un AI Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
