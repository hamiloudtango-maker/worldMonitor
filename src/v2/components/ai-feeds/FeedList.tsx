// src/v2/components/ai-feeds/FeedList.tsx
import { useState } from 'react';
import { Search, Rss, Trash2, Loader2, Sparkles } from 'lucide-react';
import type { AIFeedData } from '@/v2/lib/ai-feeds-api';

interface Props {
  feeds: AIFeedData[];
  selectedId: string | null;
  bootstrapping: boolean;
  onSelect: (feed: AIFeedData) => void;
  onCreate: () => void;
  onDelete: (id: string) => Promise<void>;
}

export default function FeedList({ feeds, selectedId, bootstrapping, onSelect, onCreate, onDelete }: Props) {
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
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Mes AI Feeds</h3>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#42d3a5] bg-slate-50"
          />
        </div>
        {/* Create AI Feed button */}
        <button
          onClick={() => onCreate()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#42d3a5]/10 text-[#2a9d7e] hover:bg-[#42d3a5]/20 transition-colors"
        >
          <Sparkles size={14} />
          <span className="text-[11px] font-semibold">Créer un AI Feed</span>
        </button>
        {bootstrapping && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 bg-violet-50 border border-violet-100 rounded-lg">
            <Sparkles size={10} className="text-violet-500 animate-pulse" />
            <span className="text-[10px] text-violet-600 font-medium">L'IA configure votre feed...</span>
          </div>
        )}
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filtered.map(feed => (
          <div
            key={feed.id}
            onClick={() => onSelect(feed)}
            className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all group cursor-pointer ${
              selectedId === feed.id
                ? 'bg-[#42d3a5]/10 border border-[#42d3a5]/20'
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              selectedId === feed.id ? 'bg-[#42d3a5]/20 text-[#2a9d7e]' : 'bg-slate-100 text-slate-400'
            }`}>
              <Rss size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-900 truncate">{feed.name}</div>
              <div className="text-[10px] text-slate-400">
                {feed.source_count} sources · {feed.result_count} articles
              </div>
            </div>
            {feed.is_template && (
              <span className="text-[8px] font-bold text-[#42d3a5] bg-[#42d3a5]/10 px-1.5 py-0.5 rounded">TPL</span>
            )}
            <button
              onClick={e => handleDelete(e, feed.id)}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
            >
              {deleting === feed.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            {search ? 'Aucun résultat' : 'Décrivez votre thématique et l\'IA configure le feed'}
          </div>
        )}
      </div>
    </div>
  );
}
