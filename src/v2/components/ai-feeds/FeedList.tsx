// src/v2/components/ai-feeds/FeedList.tsx
import { useState } from 'react';
import { Search, Rss, Trash2, Loader2, Sparkles } from 'lucide-react';
import type { AIFeedData } from '@/v2/lib/ai-feeds-api';
import { useTheme } from '@/v2/lib/theme';

interface Props {
  feeds: AIFeedData[];
  selectedId: string | null;
  bootstrapping: boolean;
  onSelect: (feed: AIFeedData) => void;
  onCreate: () => void;
  onDelete: (id: string) => Promise<void>;
}

export default function FeedList({ feeds, selectedId, bootstrapping, onSelect, onCreate, onDelete }: Props) {
  const { t } = useTheme();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = feeds.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeleting(id);
    try { await onDelete(id); } catch { /* silent */ }
    setDeleting(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4" style={{ borderBottom: `1px solid ${t.border}` }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: t.textPrimary }}>Mes AI Feeds</h3>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2" size={14} style={{ color: t.textSecondary }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none"
            style={{ background: t.bgApp, border: `1px solid ${t.border}`, color: t.textPrimary }}
          />
        </div>
        <button
          onClick={() => onCreate()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
          style={{ background: '#42d3a520', color: '#42d3a5' }}
        >
          <Sparkles size={14} />
          <span className="text-[11px] font-semibold">Créer un AI Feed</span>
        </button>
        {bootstrapping && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: '#1a1030', border: '1px solid #2d1f50' }}>
            <Sparkles size={10} className="text-violet-400 animate-pulse" />
            <span className="text-[10px] font-medium" style={{ color: '#a78bfa' }}>L'IA configure votre feed...</span>
          </div>
        )}
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map(feed => (
          <div
            key={feed.id}
            onClick={() => onSelect(feed)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all group cursor-pointer"
            style={{
              background: selectedId === feed.id ? `${t.accent}18` : 'transparent',
              border: selectedId === feed.id ? `1px solid ${t.accent}30` : '1px solid transparent',
            }}
            onMouseOver={e => { if (selectedId !== feed.id) e.currentTarget.style.background = '#162230'; }}
            onMouseOut={e => { if (selectedId !== feed.id) e.currentTarget.style.background = 'transparent'; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
              background: selectedId === feed.id ? `${t.accent}20` : t.bgApp,
              color: selectedId === feed.id ? t.accent : t.textSecondary,
            }}>
              <Rss size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: t.textPrimary }}>{feed.name}</div>
              <div className="text-[10px]" style={{ color: t.textSecondary }}>
                {feed.source_count} sources · {feed.result_count} articles
              </div>
            </div>
            {feed.is_template && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ color: '#42d3a5', background: '#42d3a515' }}>TPL</span>
            )}
            <button
              onClick={e => handleDelete(e, feed.id)}
              className="opacity-0 group-hover:opacity-100 p-1 transition-all"
              style={{ color: t.textSecondary }}
              onMouseOver={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseOut={e => (e.currentTarget.style.color = t.textSecondary)}
            >
              {deleting === feed.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: t.textSecondary }}>
            {search ? 'Aucun résultat' : 'Décrivez votre thématique et l\'IA configure le feed'}
          </div>
        )}
      </div>
    </div>
  );
}
