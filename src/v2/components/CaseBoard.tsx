/**
 * CaseBoard — investigation board per case.
 * Identity card fixed at top, everything else is a free WidgetGrid.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2,
  Building, Users, Flag, Hash
} from 'lucide-react';
import type { CaseData, CaseStats } from '@/v2/lib/api';
import { getCaseArticles, getCaseStats, forceIngestCase, updateCase } from '@/v2/lib/api';
import type { Article } from '@/v2/lib/constants';
import IdentityCard from './IdentityCard';
import ModelQueryBuilder, { type ModelLayer } from './shared/ModelQueryBuilder';
import WidgetGrid, { type WidgetDef, type WidgetState } from './WidgetGrid';
import { FULL_CATALOG, renderSharedWidget, buildCatalogWithFeeds } from './shared/WidgetCatalog';
import { getLimit } from '@/v2/lib/display-settings';

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
  // model_layers: the single source of truth for the query
  const [queryLayers, setQueryLayers] = useState<ModelLayer[]>(
    (caseData.query?.model_layers || []).map(l => ({
      operator: l.operator as ModelLayer['operator'],
      model_ids: l.model_ids || [],
    }))
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Sequential: articles first (runs _ensure_matching), then stats (skips matching)
      const a = await getCaseArticles(caseData.id, { limit: getLimit('caseArticleLimit') });
      setArticles(a.articles);
      const s = await getCaseStats(caseData.id);
      console.log('[CaseBoard.load]', a.articles.length, 'articles, total:', s.total);
      setStats(s);
    } catch (err) { console.error('[CaseBoard.load] FAILED', err); }
    setLoading(false);
  }, [caseData.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { buildCatalogWithFeeds().then(setCatalog); }, []);
  const [saving, setSaving] = useState(false);

  async function handleSaveQuery() {
    if (saving) return;
    setSaving(true);
    try {
      // Send model_layers directly — no conversion needed
      await updateCase(currentCase.id, { query: { model_layers: queryLayers } });
      await load();
    } catch (err) {
      console.error('[CaseBoard] save failed', err);
    }
    setSaving(false);
  }

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
    <div className="h-full bg-[#131d2a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[#1a2836] border-b border-[#1e2d3d] flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-lg text-[#556677] hover:text-[#8899aa] hover:bg-[#162230] transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-[#42d3a5]" />
            <h1 className="text-base font-bold text-[#b0bec9]">{currentCase.name}</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#131d2a] text-[#6b7d93] uppercase tracking-wide">
              {TYPE_LABEL[currentCase.type] ?? currentCase.type}
            </span>
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-[#556677]" />}
        </div>
        <button onClick={handleIngest} disabled={ingesting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-[#1e2d3d] text-[#8899aa] hover:ring-1 hover:ring-[#42d3a5]/30 transition-colors disabled:opacity-50">
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
          <div className="flex-1 bg-[#1a2836] rounded-xl border border-[#1e2d3d]/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-bold text-[#b0bec9]">Perimetre de veille</h3>
              {!editingDesc && (
                <button onClick={() => { setDescDraft(currentCase.identity_card?.description || ''); setEditingDesc(true); }}
                  className="text-[11px] text-[#42d3a5] hover:underline">Modifier</button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={4}
                  placeholder="Decrivez le perimetre de veille..."
                  className="w-full px-3 py-2 bg-[#0f1923] border border-[#1e2d3d] rounded-lg text-[12px] text-[#8899aa] outline-none focus:border-[#42d3a5] resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 text-[11px] text-[#6b7d93] border border-[#1e2d3d] rounded-lg hover:ring-1 hover:ring-[#42d3a5]/30">Annuler</button>
                  <button onClick={handleUpdateDescription} disabled={regenerating}
                    className="px-3 py-1.5 text-[11px] text-white font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1" style={{ background: '#42d3a5' }}>
                    {regenerating ? <><Loader2 size={12} className="animate-spin" /> Regeneration...</> : 'Sauver & Regenerer'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[12px] text-[#8899aa] leading-relaxed">{currentCase.identity_card?.description || 'Aucune description.'}</p>
                <ModelQueryBuilder layers={queryLayers} onChange={setQueryLayers} />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={handleSaveQuery} disabled={saving}
                    className="px-4 py-1.5 text-[11px] font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: '#42d3a5' }}>
                    {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Widget grid */}
        <WidgetGrid
          catalog={catalog}
          storageKey={`wm-case-${currentCase.id}-v3`}
          defaultWidgets={CASE_DEFAULTS}
          renderContent={id => {
            const shared = renderSharedWidget(id, articles, caseStats, 'cb');
            return shared || <div className="flex items-center justify-center h-full text-sm text-[#556677]">Widget</div>;
          }}
        />
      </div>
    </div>
  );
}
