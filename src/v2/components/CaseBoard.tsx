/**
 * CaseBoard — investigation board per case.
 * Identity card fixed at top, everything else is a free WidgetGrid.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2,
  Building, Users, Flag, Hash
} from 'lucide-react';
import type { CaseData, CaseStats } from '@/v2/lib/api';
import { getCaseArticles, getCaseStats, forceIngestCase, updateCase } from '@/v2/lib/api';
import type { Article } from '@/v2/lib/constants';
import IdentityCard from './IdentityCard';
import WidgetGrid, { type WidgetDef, type WidgetState } from './WidgetGrid';
import { FULL_CATALOG, renderSharedWidget, buildCatalogWithFeeds } from './shared/WidgetCatalog';

interface Props {
  caseData: CaseData;
  onBack: () => void;
}

const TYPE_ICON: Record<string, typeof Building> = { company: Building, person: Users, country: Flag, thematic: Hash };
const TYPE_LABEL: Record<string, string> = { company: 'Entreprise', person: 'Personne', country: 'Pays', thematic: 'Thematique' };

const CASE_DEFAULTS: WidgetState[] = [
  { id: 'kpis', w: 12, h: 2 },
  { id: 'map', w: 8, h: 8 },
  { id: 'alerts', w: 4, h: 8 },
  { id: 'news', w: 12, h: 6 },
  { id: 'countrymatrix', w: 12, h: 8 },
  { id: 'sentiment', w: 6, h: 5 },
  { id: 'themes', w: 6, h: 5 },
  { id: 'topentities', w: 6, h: 6 },
  { id: 'velocity', w: 6, h: 5 },
  { id: 'themeradar', w: 6, h: 6 },
  { id: 'srccover', w: 6, h: 6 },
];

export default function CaseBoard({ caseData, onBack }: Props) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [currentCase, setCurrentCase] = useState(caseData);
  const [catalog, setCatalog] = useState<WidgetDef[]>(FULL_CATALOG);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        getCaseArticles(caseData.id, { limit: 200 }),
        getCaseStats(caseData.id),
      ]);
      setArticles(a.articles);
      setStats(s);
    } catch { /* silent */ }
    setLoading(false);
  }, [caseData.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { buildCatalogWithFeeds().then(setCatalog); }, []);

  async function handleIngest() {
    setIngesting(true);
    try { await forceIngestCase(currentCase.id); await load(); } catch {}
    setIngesting(false);
  }

  async function handleUpdateDescription() {
    setRegenerating(true);
    try {
      const updated = await updateCase(currentCase.id, { description: descDraft, regenerate: true });
      setCurrentCase(updated);
      setEditingDesc(false);
      await load();
    } catch {}
    setRegenerating(false);
  }

  const Icon = TYPE_ICON[currentCase.type] ?? Building;
  const caseStats = stats ? { total: stats.total, by_theme: stats.by_theme, by_threat: stats.by_threat, by_source: stats.by_source || {} } : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-[#42d3a5]" />
            <h1 className="text-base font-bold text-slate-900">{currentCase.name}</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 uppercase tracking-wide">
              {TYPE_LABEL[currentCase.type] ?? currentCase.type}
            </span>
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
        <button onClick={handleIngest} disabled={ingesting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={ingesting ? 'animate-spin' : ''} />
          {ingesting ? 'Ingestion...' : 'Actualiser'}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Identity card + description editor — fixed */}
        <div className="flex gap-4 items-start">
          <div className="w-80 shrink-0">
            <IdentityCard card={currentCase.identity_card} caseName={currentCase.name} />
          </div>
          <div className="flex-1 bg-white rounded-xl border border-slate-200/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-bold text-slate-900">Perimetre de veille</h3>
              {!editingDesc && (
                <button onClick={() => { setDescDraft(currentCase.identity_card?.description || ''); setEditingDesc(true); }}
                  className="text-[11px] text-[#42d3a5] hover:underline">Modifier</button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={4}
                  placeholder="Decrivez le perimetre de veille..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-700 outline-none focus:border-[#42d3a5] resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 text-[11px] text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
                  <button onClick={handleUpdateDescription} disabled={regenerating}
                    className="px-3 py-1.5 text-[11px] text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1" style={{ background: '#42d3a5' }}>
                    {regenerating ? <><Loader2 size={12} className="animate-spin" /> Regeneration...</> : 'Sauver & Regenerer'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[12px] text-slate-600 leading-relaxed">{currentCase.identity_card?.description || 'Aucune description.'}</p>
                {currentCase.search_keywords && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {currentCase.search_keywords.split('|').map((kw, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Widget grid — all widgets, fully customizable */}
        <WidgetGrid
          catalog={catalog}
          storageKey={`wm-case-${currentCase.id}-v3`}
          defaultWidgets={CASE_DEFAULTS}
          onRefresh={load}
          loading={loading}
          renderContent={id => {
            const shared = renderSharedWidget(id, articles, caseStats, 'cb');
            return shared || <div className="flex items-center justify-center h-full text-sm text-slate-400">Widget</div>;
          }}
        />
      </div>
    </div>
  );
}
