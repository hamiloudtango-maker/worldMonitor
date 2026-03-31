/**
 * CasesView — Grid d'accueil + sidebar rail + onglets de cases.
 * Clic sur une carte → board s'ouvre avec un rail à gauche.
 * Chaque case cliqué dans le rail s'ouvre en onglet.
 * Bouton retour → revient à la grille.
 */
import { useState } from 'react';
import {
  Building, Users, Flag, Hash, Search, Plus, Trash2,
  FileText, AlertTriangle, Loader2, ArrowLeft, X
} from 'lucide-react';
import type { CaseData } from '@/v2/lib/api';
import CreateCaseModal from './CreateCaseModal';
import CaseBoard from './CaseBoard';

interface Props {
  cases: CaseData[];
  loading: boolean;
  onAdd: (name: string, type: string, description?: string) => Promise<CaseData>;
  onRemove: (id: string) => Promise<void>;
}

const FILTERS = [
  { key: 'all',       label: 'Tous' },
  { key: 'company',   label: 'Entreprises' },
  { key: 'country',   label: 'Pays' },
  { key: 'person',    label: 'Personnes' },
  { key: 'thematic',  label: 'Thématiques' },
] as const;

const TYPE_ICON: Record<string, typeof Building> = { company: Building, person: Users, country: Flag, thematic: Hash };
const TYPE_LABEL: Record<string, string> = { company: 'Entreprise', person: 'Personne', country: 'Pays', thematic: 'Thématique' };
const ACCENT = '#42d3a5';

export default function CasesView({ cases, loading, onAdd, onRemove }: Props) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Tabs persisted in localStorage + active tab from URL hash
  const TABS_KEY = 'wm-case-tabs';
  const [openTabs, setOpenTabs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(TABS_KEY) || '[]'); } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    const hash = window.location.hash.replace('#', '');
    const fromHash = hash.startsWith('cases:') ? hash.split(':')[1] || null : null;
    if (fromHash) return fromHash;
    // Fallback: last tab from stored list
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(TABS_KEY) || '[]');
      return stored.length > 0 ? stored[stored.length - 1]! : null;
    } catch { return null; }
  });

  function saveTabs(tabs: string[]) {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  }

  function openCase(c: CaseData) {
    const next = openTabs.includes(c.id) ? openTabs : [...openTabs, c.id];
    setOpenTabs(next);
    saveTabs(next);
    setActiveTab(c.id);
    window.location.hash = `cases:${c.id}`;
  }

  function closeTab(id: string) {
    const next = openTabs.filter(t => t !== id);
    setOpenTabs(next);
    saveTabs(next);
    if (activeTab === id) {
      const newActive = next.length > 0 ? next[next.length - 1]! : null;
      setActiveTab(newActive);
      window.location.hash = newActive ? `cases:${newActive}` : 'cases';
    }
  }

  function backToGrid() {
    setOpenTabs([]);
    saveTabs([]);
    setActiveTab(null);
    window.location.hash = 'cases';
  }

  const filtered = cases.filter(c => {
    if (filter !== 'all' && c.type !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeleting(id);
    try {
      await onRemove(id);
      closeTab(id);
    } catch { /* silent */ }
    setDeleting(null);
  }

  const activeCase = activeTab ? cases.find(c => c.id === activeTab) : null;
  const inBoardMode = openTabs.length > 0;

  /* ═══════ BOARD MODE: sidebar + tabs + case board ═══════ */
  if (inBoardMode) {
    return (
      <div className="flex gap-0 h-[calc(100vh-7.5rem)]">
        {/* ── Sidebar rail ── */}
        <div className="w-52 flex flex-col shrink-0 bg-[#1a2836] border-r border-[#1e2d3d]/60 rounded-l-xl overflow-hidden">
          <button
            onClick={backToGrid}
            className="flex items-center gap-2 px-3 py-2.5 text-[11px] font-semibold text-[#6b7d93] hover:text-[#2a9d7e] hover:ring-1 hover:ring-[#42d3a5]/30 border-b border-[#1e2d3d] transition-colors"
          >
            <ArrowLeft size={14} /> Tous les cases
          </button>

          <div className="p-2 border-b border-[#1e2d3d]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#556677]" size={11} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrer..."
                className="w-full pl-7 pr-2 py-1 bg-[#0f1923] border border-[#1e2d3d] rounded-lg text-[11px] outline-none focus:border-[#42d3a5]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.map(c => {
              const Icon = TYPE_ICON[c.type] ?? FileText;
              const isActive = c.id === activeTab;
              const isOpen = openTabs.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => openCase(c)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-[#42d3a5]/10 border border-[#42d3a5]/30'
                      : isOpen
                        ? 'bg-[#0f1923] border border-[#1e2d3d]/60'
                        : 'border border-transparent hover:ring-1 hover:ring-[#42d3a5]/30'
                  }`}
                >
                  <Icon size={13} className={isActive ? 'text-[#42d3a5]' : isOpen ? 'text-[#6b7d93]' : 'text-[#556677]'} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-[#2a9d7e]' : 'text-[#8899aa]'}`}>
                      {c.name}
                    </div>
                    <div className="text-[9px] text-[#556677]">{c.article_count} art.</div>
                  </div>
                  {c.alert_count > 0 && (
                    <span className="text-[8px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                      {c.alert_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-[#1e2d3d]">
            <button
              onClick={() => setShowModal(true)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold text-white rounded-lg"
              style={{ background: ACCENT }}
            >
              <Plus size={12} /> Nouveau
            </button>
          </div>
        </div>

        {/* ── Right: tabs + board ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-2 pt-1 bg-[#0f1923] border-b border-[#1e2d3d]/60 overflow-x-auto shrink-0">
            {openTabs.map(tabId => {
              const c = cases.find(cs => cs.id === tabId);
              if (!c) return null;
              const isActive = tabId === activeTab;
              const Icon = TYPE_ICON[c.type] ?? FileText;
              return (
                <button
                  key={tabId}
                  onClick={() => { setActiveTab(tabId); window.location.hash = `cases:${tabId}`; }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#1a2836] text-[#2a9d7e] font-semibold border border-b-0 border-[#1e2d3d]/60 -mb-px'
                      : 'text-[#556677] hover:text-[#8899aa] hover:bg-[#1a2836]/50'
                  }`}
                >
                  <Icon size={11} />
                  {c.name}
                  {c.alert_count > 0 && (
                    <span className="text-[8px] font-bold text-orange-500 bg-orange-500/10 px-1 rounded-full">{c.alert_count}</span>
                  )}
                  <span
                    onClick={e => { e.stopPropagation(); closeTab(tabId); }}
                    className="ml-0.5 p-0.5 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors"
                  >
                    <X size={9} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active case board */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeCase ? (
              <CaseBoard
                key={activeCase.id}
                caseData={activeCase}
                onBack={() => closeTab(activeCase.id)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[#556677]">
                Sélectionnez un case dans la liste
              </div>
            )}
          </div>
        </div>

        <CreateCaseModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onCreate={async (name, type, desc) => { await onAdd(name, type, desc); }}
        />
      </div>
    );
  }

  /* ═══════ GRID MODE: card overview (page d'accueil) ═══════ */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-[#1a2836] rounded-lg border border-[#1e2d3d]/60 p-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                filter === f.key ? 'bg-[#42d3a5]/10 text-[#2a9d7e] font-semibold' : 'text-[#556677] hover:text-[#8899aa]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#556677]" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer..."
              className="w-48 pl-8 pr-3 py-1.5 bg-[#1a2836] border border-[#1e2d3d] rounded-lg text-[13px] outline-none focus:border-[#42d3a5] focus:ring-1 focus:ring-[#42d3a5]/20 transition-all"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-white text-[12px] font-semibold rounded-lg shadow-sm transition-colors hover:brightness-110"
            style={{ background: ACCENT }}
          >
            <Plus size={14} /> Créer un case
          </button>
        </div>
      </div>

      {loading && cases.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[#556677]" />
        </div>
      )}

      {!loading && cases.length === 0 && (
        <div className="bg-[#1a2836] rounded-xl border border-[#1e2d3d]/60 p-12 text-center">
          <FileText size={40} className="mx-auto text-[#3a4f63] mb-4" />
          <h3 className="text-lg font-bold text-[#b0bec9] mb-2">Aucun case</h3>
          <p className="text-sm text-[#6b7d93] mb-6">Créez votre premier case pour commencer la veille intelligente.</p>
          <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-sm" style={{ background: ACCENT }}>
            <Plus size={16} /> Créer un case
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(c => {
            const Icon = TYPE_ICON[c.type] ?? FileText;
            return (
              <div
                key={c.id}
                onClick={() => openCase(c)}
                className="rounded-xl overflow-hidden cursor-pointer transition-all group relative"
                style={{ background: '#1a2836', border: '1px solid #1e2d3d' }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#42d3a540'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#1e2d3d'; }}
              >
                {/* Header band with type color */}
                <div className="h-1.5" style={{
                  background: c.type === 'company' ? '#3b82f6' : c.type === 'country' ? '#22c55e' : c.type === 'person' ? '#a855f7' : '#f97316',
                }} />

                <div className="p-4">
                  <button
                    onClick={e => handleDelete(e, c.id)}
                    className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
                    style={{ color: '#556677' }}
                    title="Supprimer"
                  >
                    {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                      style={{ background: '#131d2a', color: '#6b7d93' }}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[14px] truncate" style={{ color: '#e2e8f0' }}>{c.name}</div>
                      <div className="text-[10px]" style={{ color: '#556677' }}>{TYPE_LABEL[c.type] ?? c.type}</div>
                    </div>
                  </div>

                  {c.identity_card?.description && (
                    <p className="text-[11px] leading-relaxed line-clamp-2 mb-3" style={{ color: '#6b7d93' }}>{c.identity_card.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[10px]" style={{ color: '#556677' }}>
                      <span className="flex items-center gap-1"><FileText size={11} /> {c.article_count} articles</span>
                      {c.alert_count > 0 && (
                        <span className="flex items-center gap-1 font-semibold" style={{ color: '#f97316' }}>
                          <AlertTriangle size={11} /> {c.alert_count} alertes
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: '#131d2a', color: '#6b7d93' }}>
                      {c.status || 'actif'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && cases.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-[#556677]">Aucun case ne correspond aux filtres.</div>
      )}

      <CreateCaseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreate={async (name, type, description) => { await onAdd(name, type, description); }}
      />
    </div>
  );
}
