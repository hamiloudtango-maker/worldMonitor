// src/v2/components/AIFeedsView.tsx
import { useState } from 'react';
import { useAIFeeds } from '@/v2/hooks/useAIFeeds';
import type { AIFeedData, FeedQuery } from '@/v2/lib/ai-feeds-api';
import { bootstrapFeed, refreshFeed } from '@/v2/lib/ai-feeds-api';
import FeedList from './ai-feeds/FeedList';
import ModelQueryBuilder, { type ModelLayer } from './shared/ModelQueryBuilder';
import FeedPreview from './ai-feeds/FeedPreview';
import FeedCreator from './ai-feeds/FeedCreator';
import RssBulkAdd from './ai-feeds/RssBulkAdd';
import { useTheme } from '@/v2/lib/theme';

export default function AIFeedsView() {
  const { t } = useTheme();
  const { feeds, add, remove, update } = useAIFeeds();
  const [selected, setSelected] = useState<AIFeedData | null>(null);
  const [localModelLayers, setLocalModelLayers] = useState<ModelLayer[]>([]);
  const [dirty, setDirty] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  function handleSelect(feed: AIFeedData) {
    setSelected(feed);
    setLocalModelLayers(feed.query?.model_layers || []);
    setDirty(false);
    setCreating(false);
  }

  function handleModelLayersChange(layers: ModelLayer[]) {
    setLocalModelLayers(layers);
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

      // Bootstrap to get AI description
      const bootstrap = await bootstrapFeed(name);
      if (bootstrap.description) {
        await update(feed.id, { query, description: bootstrap.description });
      }

      setLocalModelLayers(query.model_layers || []);
      setDirty(false);
      setCreating(false);
      await refreshFeed(feed.id);
      const refreshed = await import('@/v2/lib/ai-feeds-api').then(m => m.getFeed(feed.id));
      setSelected(refreshed);
      setPreviewKey(k => k + 1);
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
      setLocalModelLayers([]);
    }
  }

  async function handleSave() {
    if (!selected || !dirty) return;
    setRefreshing(true);
    try {
      // Save query to DB, then reload preview (endpoint does _ensure_matching)
      await update(selected.id, { query: { layers: [], model_layers: localModelLayers } });
      setDirty(false);
    } catch (err) { console.error('[Feed] save failed', err); }
    // Increment key to trigger FeedPreview reload — refreshing state is
    // managed by FeedPreview's own loading state, so reset here.
    setPreviewKey(k => k + 1);
    setRefreshing(false);
  }

  function handleRefresh() {
    if (!selected) return;
    // Just increment key — FeedPreview handles its own loading state
    setPreviewKey(k => k + 1);
  }


  return (
    <div className="flex h-full -m-5 rounded-xl overflow-hidden" style={{ background: t.bgApp, border: `1px solid ${t.border}` }}>
      {/* Left: Feed list + RSS bulk add */}
      <div className="w-72 flex flex-col shrink-0" style={{ borderRight: `1px solid ${t.border}`, background: t.bgSidebar }}>
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
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.border}` }}>
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
                    className="text-sm font-bold bg-transparent border-b border-[#42d3a5] focus:outline-none px-0 py-0" style={{ color: t.textPrimary }}
                  />
                ) : (
                  <h2
                    className="text-sm font-bold cursor-pointer hover:text-[#42d3a5] transition-colors" style={{ color: t.textPrimary }}
                    onClick={() => { setEditName(selected.name); setEditingName(true); }}
                    title="Cliquer pour renommer"
                  >
                    {selected.name}
                  </h2>
                )}
                <p className="text-[10px]" style={{ color: `${t.textSecondary}` }}>
                  {previewCount || selected.result_count} articles · {selected.status}
                  {selected.description && <span className="ml-1">— {selected.description}</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRefresh}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors"
                  style={{ color: t.textPrimary, border: `1px solid ${t.border}` }}
                >
                  Rafraichir
                </button>
                {dirty && (
                  <button
                    onClick={handleSave}
                    disabled={refreshing}
                    className="px-4 py-1.5 text-[11px] font-semibold text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
                    style={{ background: '#42d3a5' }}
                  >
                    {refreshing ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <ModelQueryBuilder layers={localModelLayers} onChange={handleModelLayersChange} />
              <div className="pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                <FeedPreview feedId={selected.id} onCountChange={setPreviewCount} refreshKey={previewKey} />
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Empty state — prompt to create */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `linear-gradient(135deg, ${t.bgCard}, ${t.bgSidebar})` }}>
              <svg className="w-8 h-8" style={{ color: `#42d3a5` }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold mb-1" style={{ color: t.textHeading }}>AI Feeds</h3>
            <p className="text-[11px] leading-relaxed mb-4" style={{ color: t.textSecondary }}>
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
