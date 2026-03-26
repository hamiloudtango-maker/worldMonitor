import { useState } from 'react';
import { Building, Users, Flag, Hash, Search, Plus, Trash2, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import type { CaseData } from '@/v2/lib/api';
import CreateCaseModal from './CreateCaseModal';

interface Props {
  cases: CaseData[];
  loading: boolean;
  onAdd: (name: string, type: string, description?: string) => Promise<CaseData>;
  onRemove: (id: string) => Promise<void>;
  onSelect: (c: CaseData) => void;
  onOpenBoard: (c: CaseData) => void;
}

const FILTERS = [
  { key: 'all',       label: 'Tous' },
  { key: 'company',   label: 'Entreprises' },
  { key: 'country',   label: 'Pays' },
  { key: 'person',    label: 'Personnes' },
  { key: 'thematic',  label: 'Thématiques' },
] as const;

const TYPE_ICON: Record<string, typeof Building> = {
  company: Building,
  person: Users,
  country: Flag,
  thematic: Hash,
};

const TYPE_LABEL: Record<string, string> = {
  company: 'Entreprise',
  person: 'Personne',
  country: 'Pays',
  thematic: 'Thématique',
};

export default function CasesView({ cases, loading, onAdd, onRemove, onSelect, onOpenBoard }: Props) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

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
    } catch { /* silent */ }
    setDeleting(null);
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer..."
              className="w-48 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] outline-none focus:border-[#42d3a5] focus:ring-1 focus:ring-[#42d3a5]/20 transition-all"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-white text-[12px] font-semibold rounded-lg shadow-sm transition-colors hover:brightness-110"
            style={{ background: '#42d3a5' }}
          >
            <Plus size={14} /> Créer un case
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && cases.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && cases.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200/60 p-12 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">Aucun case</h3>
          <p className="text-sm text-slate-500 mb-6">Créez votre premier case pour commencer la veille intelligente.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-sm"
            style={{ background: '#42d3a5' }}
          >
            <Plus size={16} /> Créer un case
          </button>
        </div>
      )}

      {/* Cards grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(c => {
            const Icon = TYPE_ICON[c.type] ?? FileText;
            return (
              <div
                key={c.id}
                onClick={() => onOpenBoard(c)}
                className="bg-white p-4 rounded-xl border border-slate-200/60 hover:border-[#42d3a5]/30 hover:shadow-md cursor-pointer transition-all group relative"
              >
                {/* Delete button — visible on hover */}
                <button
                  onClick={e => handleDelete(e, c.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  title="Supprimer"
                >
                  {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>

                {/* Type icon + name */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-[#42d3a5]/10 group-hover:text-[#42d3a5] transition-colors shrink-0">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 group-hover:text-[#2a9d7e] transition-colors truncate">{c.name}</div>
                    <div className="text-[10px] text-slate-400">{TYPE_LABEL[c.type] ?? c.type}</div>
                  </div>
                </div>

                {/* Description */}
                {c.identity_card?.description && (
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{c.identity_card.description}</p>
                )}

                {/* Footer: counts */}
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <FileText size={11} /> {c.article_count} articles
                  </span>
                  {c.alert_count > 0 && (
                    <span className="flex items-center gap-1 text-orange-500 font-semibold">
                      <AlertTriangle size={11} /> {c.alert_count} alertes
                    </span>
                  )}
                </div>

                {/* Hint */}
                <div className="absolute bottom-1 right-3 text-[8px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                  Double-clic → Board
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results for current filter */}
      {!loading && cases.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-slate-400">Aucun case ne correspond aux filtres.</div>
      )}

      {/* Modal */}
      <CreateCaseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreate={async (name, type, description) => { await onAdd(name, type, description); }}
      />
    </div>
  );
}
