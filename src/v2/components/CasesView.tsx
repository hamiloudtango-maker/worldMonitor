/**
 * CasesView — Split layout: case list (left) + tabbed case boards (right).
 * Each click opens a case as a tab. Tabs persist until closed.
 */
import { useState } from 'react';
import { Building, Users, Flag, Hash, Search, Plus, Trash2, FileText, AlertTriangle, Loader2, X } from 'lucide-react';
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

  // Tab state: which cases are open, which is active
  const [openTabs, setOpenTabs] = useState<string[]>([]);   // case IDs
  const [activeTab, setActiveTab] = useState<string | null>(null);

  function openCase(c: CaseData) {
    if (!openTabs.includes(c.id)) {
      setOpenTabs(prev => [...prev, c.id]);
    }
    setActiveTab(c.id);
  }

  function closeTab(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t !== id);
      // If we closed the active tab, switch to the last remaining or null
      if (activeTab === id) {
        setActiveTab(next.length > 0 ? next[next.length - 1] : null);
      }
      return next;
    });
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
      // Close tab if open
      setOpenTabs(prev => prev.filter(t => t !== id));
      if (activeTab === id) setActiveTab(null);
    } catch { /* silent */ }
    setDeleting(null);
  }

  const activeCaseData = activeTab ? cases.find(c => c.id === activeTab) : null;
  const hasTabs = openTabs.length > 0;

  return (
    <div className="flex gap-3 h-[calc(100vh-7.5rem)]">
      {/* ── LEFT: Case list ── */}
      <div className={`${hasTabs ? 'w-64' : 'flex-1'} flex flex-col shrink-0 transition-all duration-200`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {!hasTabs && (
            <div className="flex gap-1 bg-white rounded-lg border border-slate-200/60 p-0.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                    filter === f.key ? 'bg-[#42d3a5]/10 text-[#2a9d7e] font-semibold' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          {hasTabs && (
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filtrer..."
                className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] outline-none focus:border-[#42d3a5]"
              />
            </div>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-white text-[11px] font-semibold rounded-lg shrink-0"
            style={{ background: ACCENT }}
          >
            <Plus size={12} /> {hasTabs ? '' : 'Créer un case'}
          </button>
        </div>

        {/* Search (only when no tabs — full width view) */}
        {!hasTabs && (
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[#42d3a5]"
            />
          </div>
        )}

        {/* Loading */}
        {loading && cases.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        )}

        {/* Empty state */}
        {!loading && cases.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200/60 p-8 text-center">
            <FileText size={32} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">Aucun case</h3>
            <p className="text-[11px] text-slate-500 mb-4">Créez votre premier case.</p>
            <button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl" style={{ background: ACCENT }}>
              <Plus size={14} /> Créer
            </button>
          </div>
        )}

        {/* Case list */}
        <div className={`flex-1 overflow-y-auto space-y-1.5 ${hasTabs ? '' : ''}`}>
          {hasTabs ? (
            /* Compact list mode */
            filtered.map(c => {
              const Icon = TYPE_ICON[c.type] ?? FileText;
              const isActive = c.id === activeTab;
              const isOpen = openTabs.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => openCase(c)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                    isActive ? 'bg-[#42d3a5]/10 border border-[#42d3a5]/30' :
                    isOpen ? 'bg-white border border-slate-200/60' :
                    'hover:bg-white border border-transparent hover:border-slate-200/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#42d3a5]' : 'text-slate-400'} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[12px] font-semibold truncate ${isActive ? 'text-[#2a9d7e]' : 'text-slate-700'}`}>{c.name}</div>
                    <div className="text-[9px] text-slate-400">{c.article_count} articles</div>
                  </div>
                  {c.alert_count > 0 && (
                    <span className="text-[9px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">{c.alert_count}</span>
                  )}
                </button>
              );
            })
          ) : (
            /* Grid mode — no tabs open */
            <div className="grid grid-cols-3 gap-3">
              {filtered.map(c => {
                const Icon = TYPE_ICON[c.type] ?? FileText;
                return (
                  <div
                    key={c.id}
                    onClick={() => openCase(c)}
                    className="bg-white p-4 rounded-xl border border-slate-200/60 hover:border-[#42d3a5]/30 hover:shadow-md cursor-pointer transition-all group relative"
                  >
                    <button
                      onClick={e => handleDelete(e, c.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Supprimer"
                    >
                      {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#42d3a5]/10 group-hover:text-[#42d3a5] transition-colors shrink-0">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 group-hover:text-[#2a9d7e] transition-colors truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{TYPE_LABEL[c.type] ?? c.type}</div>
                      </div>
                    </div>
                    {c.identity_card?.description && (
                      <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{c.identity_card.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><FileText size={11} /> {c.article_count} articles</span>
                      {c.alert_count > 0 && (
                        <span className="flex items-center gap-1 text-orange-500 font-semibold"><AlertTriangle size={11} /> {c.alert_count} alertes</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Tabbed case boards ── */}
      {hasTabs && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 mb-2 overflow-x-auto">
            {openTabs.map(tabId => {
              const c = cases.find(cs => cs.id === tabId);
              if (!c) return null;
              const isActive = tabId === activeTab;
              const Icon = TYPE_ICON[c.type] ?? FileText;
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium whitespace-nowrap transition-all border border-b-0 ${
                    isActive
                      ? 'bg-white text-[#2a9d7e] border-slate-200/60 font-semibold'
                      : 'bg-slate-50 text-slate-400 border-transparent hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={12} />
                  {c.name}
                  {c.alert_count > 0 && (
                    <span className="text-[8px] font-bold text-orange-500 bg-orange-50 px-1 rounded-full">{c.alert_count}</span>
                  )}
                  <span
                    onClick={e => closeTab(e, tabId)}
                    className="ml-1 p-0.5 rounded hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <X size={10} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active case board */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200/60 overflow-hidden">
            {activeCaseData ? (
              <CaseBoard
                key={activeCaseData.id}
                caseData={activeCaseData}
                onBack={() => {
                  closeTab({ stopPropagation: () => {} } as React.MouseEvent, activeCaseData.id);
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-slate-400">
                Sélectionnez un case
              </div>
            )}
          </div>
        </div>
      )}

      <CreateCaseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreate={async (name, type, description) => { await onAdd(name, type, description); }}
      />
    </div>
  );
}
