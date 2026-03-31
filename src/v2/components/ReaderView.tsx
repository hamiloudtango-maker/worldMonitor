// src/v2/components/ReaderView.tsx
// Inoreader-style reader layout: left sidebar (folders/sources) + article list + reader panel
import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, Plus, Star, BookmarkPlus, Rss, TrendingUp, Clock,
  ChevronRight, ChevronDown, Inbox, Settings, Loader2, Trash2,
} from 'lucide-react';
import {
  listFolders, folderArticles, listStarred, listReadLater, getTrending,
  type FolderData, type ArticleSummary,
} from '@/v2/lib/sources-api';
import { api } from '@/v2/lib/api';
import ArticleListView from './ArticleListView';
import AddSourceModal from './AddSourceModal';

const ACCENT = '#4d8cf5';

type SidebarSection = 'all' | 'starred' | 'read-later' | 'trending' | { folder: FolderData };

export default function ReaderView() {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [section, setSection] = useState<SidebarSection>('all');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showAddSource, setShowAddSource] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Load folders
  const loadFolders = useCallback(() => {
    listFolders().then(d => setFolders(d.folders)).catch(() => {});
  }, []);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  // Load articles based on selected section
  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      if (section === 'all') {
        const data = await api('/articles/v1/search?limit=100');
        setArticles((data as any).articles || []);
        setTotal((data as any).total || 0);
      } else if (section === 'starred') {
        const data = await listStarred(100);
        setArticles(data.articles);
        setTotal(data.articles.length);
      } else if (section === 'read-later') {
        const data = await listReadLater(100);
        setArticles(data.articles);
        setTotal(data.articles.length);
      } else if (section === 'trending') {
        const data = await getTrending('day', 50);
        setArticles(data.articles);
        setTotal(data.articles.length);
      } else if (typeof section === 'object' && 'folder' in section) {
        const data = await folderArticles(section.folder.id, { limit: 100 });
        setArticles(data.articles);
        setTotal(data.total);
      }
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sectionTitle = section === 'all' ? 'Tous les articles'
    : section === 'starred' ? 'Favoris'
    : section === 'read-later' ? 'Lire plus tard'
    : section === 'trending' ? 'Tendances'
    : typeof section === 'object' ? section.folder.name : '';

  return (
    <div className="flex h-full">

      {/* ── Left sidebar: folders & quick access ─────────── */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">
        {/* Quick access */}
        <div className="px-3 py-3 space-y-0.5">
          <SidebarItem
            icon={Inbox} label="Tous les articles"
            active={section === 'all'}
            onClick={() => setSection('all')}
            count={total}
          />
          <SidebarItem
            icon={TrendingUp} label="Tendances"
            active={section === 'trending'}
            onClick={() => setSection('trending')}
            color="#f97316"
          />
          <SidebarItem
            icon={Star} label="Favoris"
            active={section === 'starred'}
            onClick={() => setSection('starred')}
            color="#eab308"
          />
          <SidebarItem
            icon={BookmarkPlus} label="Lire plus tard"
            active={section === 'read-later'}
            onClick={() => setSection('read-later')}
            color="#3b82f6"
          />
        </div>

        <div className="mx-3 border-t border-slate-100" />

        {/* Folders */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dossiers</span>
            <button
              onClick={() => setShowAddSource(true)}
              className="p-0.5 text-slate-400 hover:text-[#42d3a5] rounded transition-colors"
              title="Ajouter une source"
            >
              <Plus size={14} />
            </button>
          </div>

          {folders.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[11px] text-slate-400">Aucun dossier</p>
              <button
                onClick={() => setShowAddSource(true)}
                className="mt-2 text-[11px] text-[#42d3a5] hover:underline"
              >
                + Ajouter une source
              </button>
            </div>
          )}

          {folders.map(folder => (
            <div key={folder.id} className="mb-1">
              <button
                onClick={() => {
                  toggleFolder(folder.id);
                  setSection({ folder });
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors ${
                  typeof section === 'object' && 'folder' in section && section.folder.id === folder.id
                    ? 'bg-teal-50 text-[#2a9d7e] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {expandedFolders.has(folder.id)
                  ? <ChevronDown size={12} className="text-slate-400 shrink-0" />
                  : <ChevronRight size={12} className="text-slate-400 shrink-0" />
                }
                <FolderOpen size={13} className="shrink-0" style={{ color: folder.color || '#94a3b8' }} />
                <span className="flex-1 truncate">{folder.name}</span>
                {folder.source_count > 0 && (
                  <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                    {folder.source_count}
                  </span>
                )}
              </button>

              {/* Expanded: show sources in folder */}
              {expandedFolders.has(folder.id) && folder.source_ids?.length > 0 && (
                <div className="ml-7 mt-0.5 space-y-0.5">
                  {folder.source_ids.map(sid => (
                    <div key={sid} className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-slate-500 rounded hover:bg-slate-50">
                      <Rss size={9} className="text-orange-400 shrink-0" />
                      <span className="truncate">
                        {sid.replace(/^plugin_\w+_|^catalog_/g, '').replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add source button */}
        <div className="px-3 py-3 border-t border-slate-100 shrink-0">
          <button
            onClick={() => setShowAddSource(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium text-white rounded-lg transition-colors"
            style={{ background: ACCENT }}
          >
            <Plus size={14} />
            Ajouter une source
          </button>
        </div>
      </aside>

      {/* ── Main: article list ───────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <ArticleListView
          articles={articles}
          title={sectionTitle}
          loading={loading}
          hasMore={articles.length < total}
          onLoadMore={loadArticles}
        />
      </div>

      {/* Add Source Modal */}
      <AddSourceModal
        open={showAddSource}
        onClose={() => setShowAddSource(false)}
        onAdded={() => { loadFolders(); loadArticles(); }}
      />
    </div>
  );
}

/* ── Sidebar Item ─── */
function SidebarItem({ icon: Icon, label, active, onClick, count, color }: {
  icon: typeof Inbox;
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors text-left ${
        active
          ? 'bg-teal-50 text-[#2a9d7e] font-semibold'
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={15} style={{ color: active ? ACCENT : (color || '#94a3b8') }} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {count > 999 ? '999+' : count}
        </span>
      )}
    </button>
  );
}
