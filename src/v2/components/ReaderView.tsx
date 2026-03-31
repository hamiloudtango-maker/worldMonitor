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
const BG_APP = '#131d2a';
const BG_SIDEBAR = '#0f1923';
const BORDER = '#1e2d3d';
const TEXT_PRIMARY = '#b0bec9';
const TEXT_SECONDARY = '#6b7d93';
const TEXT_MUTED = '#3a4a5a';

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
        const data = await api('/articles/v1/search?limit=200');
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
        const data = await folderArticles(section.folder.id, { limit: 200 });
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

  const sectionTitle = section === 'all' ? 'Fil d\'actualité'
    : section === 'starred' ? 'Favoris'
    : section === 'read-later' ? 'Lire plus tard'
    : section === 'trending' ? 'Tendances'
    : typeof section === 'object' ? section.folder.name : '';

  return (
    <div className="flex h-full">

      {/* ── Left sidebar: Inoreader dark — folders & quick access ─────────── */}
      <aside className="w-56 flex flex-col shrink-0" style={{ background: BG_SIDEBAR, borderRight: `1px solid ${BORDER}` }}>

        {/* Header */}
        <div className="px-3 py-3 shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT_SECONDARY }}>Flux</div>
        </div>

        {/* Quick access */}
        <div className="px-2 py-2 space-y-0.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <SidebarItem
            icon={Inbox} label="Fil d'actualité"
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

        {/* Folders */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: TEXT_SECONDARY }}>Dossiers</span>
            <button
              onClick={() => setShowAddSource(true)}
              className="p-0.5 rounded transition-colors"
              style={{ color: TEXT_SECONDARY }}
              title="Ajouter une source"
            >
              <Plus size={14} />
            </button>
          </div>

          {folders.length === 0 && (
            <div className="text-center py-4">
              <p className="text-[11px]" style={{ color: TEXT_SECONDARY }}>Aucun dossier</p>
              <button
                onClick={() => setShowAddSource(true)}
                className="mt-2 text-[11px] hover:underline"
                style={{ color: ACCENT }}
              >
                + Ajouter une source
              </button>
            </div>
          )}

          {folders.map(folder => {
            const isActive = typeof section === 'object' && 'folder' in section && section.folder.id === folder.id;
            return (
              <div key={folder.id} className="mb-0.5">
                <button
                  onClick={() => {
                    toggleFolder(folder.id);
                    setSection({ folder });
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors"
                  style={{
                    background: isActive ? `${ACCENT}18` : 'transparent',
                    color: isActive ? ACCENT : TEXT_PRIMARY,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {expandedFolders.has(folder.id)
                    ? <ChevronDown size={12} style={{ color: TEXT_SECONDARY }} className="shrink-0" />
                    : <ChevronRight size={12} style={{ color: TEXT_SECONDARY }} className="shrink-0" />
                  }
                  <FolderOpen size={13} className="shrink-0" style={{ color: folder.color || TEXT_SECONDARY }} />
                  <span className="flex-1 truncate">{folder.name}</span>
                  {folder.source_count > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ color: TEXT_SECONDARY, background: '#1a2836' }}>
                      {folder.source_count}
                    </span>
                  )}
                </button>

                {/* Expanded: show sources in folder */}
                {expandedFolders.has(folder.id) && folder.source_ids?.length > 0 && (
                  <div className="ml-7 mt-0.5 space-y-0.5">
                    {folder.source_ids.map(sid => (
                      <div key={sid} className="flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition-colors"
                        style={{ color: TEXT_SECONDARY }}
                        onMouseOver={e => { e.currentTarget.style.background = '#1a2836'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Rss size={9} className="shrink-0" style={{ color: '#f97316' }} />
                        <span className="truncate">
                          {sid.replace(/^plugin_\w+_|^catalog_/g, '').replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add source button */}
        <div className="px-3 py-3 shrink-0" style={{ borderTop: `1px solid ${BORDER}` }}>
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
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: BG_APP }}>
        <ArticleListView
          articles={articles}
          title={sectionTitle}
          loading={loading}
          hasMore={articles.length < total}
          onLoadMore={loadArticles}
          unreadCount={total}
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

/* ── Sidebar Item — Inoreader dark ─── */
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
      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors text-left"
      style={{
        background: active ? `${ACCENT}18` : 'transparent',
        color: active ? ACCENT : TEXT_PRIMARY,
        fontWeight: active ? 600 : 400,
      }}
    >
      <Icon size={15} style={{ color: active ? ACCENT : (color || '#6b7d93') }} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
          style={{ color: TEXT_SECONDARY, background: '#1a2836' }}>
          {count > 999 ? '999+' : count}
        </span>
      )}
    </button>
  );
}
