// src/v2/components/AIFeedsView.tsx
import { useState } from 'react';
import { useAIFeeds } from '@/v2/hooks/useAIFeeds';
import type { AIFeedData, FeedQuery } from '@/v2/lib/ai-feeds-api';
import { bootstrapFeed, addFeedSource } from '@/v2/lib/ai-feeds-api';
import FeedList from './ai-feeds/FeedList';
import QueryBuilder from './ai-feeds/QueryBuilder';
import SourceSelector from './ai-feeds/SourceSelector';
import FeedPreview from './ai-feeds/FeedPreview';

export default function AIFeedsView() {
  const { feeds, add, remove, update } = useAIFeeds();
  const [selected, setSelected] = useState<AIFeedData | null>(null);
  const [localQuery, setLocalQuery] = useState<FeedQuery>({ layers: [] });
  const [dirty, setDirty] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  // Used to force SourceSelector to reload after bootstrap adds sources
  const [sourceKey, setSourceKey] = useState(0);

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
    setBootstrapping(true);
    try {
      // 1. Ask AI to generate query + suggest sources
      const bootstrap = await bootstrapFeed(name);

      // 2. Create the feed with AI-generated query and description
      const query = bootstrap.query?.layers?.length ? bootstrap.query : { layers: [] };
      const feed = await add(name, bootstrap.description || '', query);

      // 3. Auto-add AI-suggested sources to the feed
      if (bootstrap.resolved_sources?.length && feed.id) {
        const addPromises = bootstrap.resolved_sources.map(s =>
          addFeedSource(feed.id, {
            url: s.url,
            name: s.name,
            lang: s.lang ?? undefined,
            tier: s.tier,
            source_type: s.source_type ?? undefined,
            country: s.country ?? undefined,
            continent: s.continent ?? undefined,
            origin: 'ai_suggested',
          }).catch(() => null)
        );
        await Promise.all(addPromises);
      }

      // 4. Save query to the feed
      if (query.layers.length) {
        await update(feed.id, { query, description: bootstrap.description });
      }

      // 5. Select the new feed and show its pre-filled state
      setLocalQuery(query);
      setSelected({ ...feed, source_count: bootstrap.resolved_sources?.length || 0 });
      setDirty(false);
      setSourceKey(k => k + 1); // Force SourceSelector to reload
    } catch {
      // Fallback: create empty feed
      const feed = await add(name);
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
      {/* Left: Feed list */}
      <FeedList
        feeds={feeds}
        selectedId={selected?.id || null}
        bootstrapping={bootstrapping}
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
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-50 to-emerald-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#42d3a5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">AI Feeds</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Décrivez une thématique et l'IA configure automatiquement les filtres de recherche et
                sélectionne les sources RSS les plus pertinentes parmi 147 sources mondiales.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                {['M&A Énergie', 'Cyber Menaces', 'Diplomatie Asie', 'Tech Startups', 'Conflits Afrique'].map(ex => (
                  <span key={ex} className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{ex}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Source selector */}
      <div className="w-80 shrink-0 bg-white">
        <SourceSelector key={sourceKey} feedId={selected?.id || null} />
      </div>
    </div>
  );
}
