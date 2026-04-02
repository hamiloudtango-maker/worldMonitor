// src/v2/components/AutomateView.tsx
// Inoreader-style Automate section: Rules, Filters, Spotlights, Digests, OPML, Reports
// Full CRUD connected to backend APIs
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap, Filter, Sparkles, Mail, FileText, Rss, Plus, ChevronRight,
  Trash2, ToggleLeft, ToggleRight, Play, X, Upload, Download, Clock,
  Check, Loader2, Eye, Settings,
} from 'lucide-react';
import { useTheme } from '@/v2/lib/theme';
import {
  listRules, createRule, updateRule, deleteRule, toggleRule, testRule,
  getRuleTemplates, type RuleData,
  listSpotlights, createSpotlight, updateSpotlight, deleteSpotlight, type SpotlightData,
  listDigests, createDigest, updateDigest, deleteDigest, toggleDigest, previewDigest, type DigestData,
  exportOpml, importOpml,
  listReports, createReport, updateReport, deleteReport, toggleReport, generateReport, type ReportData,
} from '@/v2/lib/api';

// ═══════════════════════════════════════════════════════════════
// SECTION CONFIG
// ═══════════════════════════════════════════════════════════════
const SECTIONS = [
  { id: 'rules', icon: Zap, color: '#d4b85c', title: 'Rules', desc: 'Actions automatiques sur les articles. Tags, notifications, webhooks.' },
  { id: 'filters', icon: Filter, color: '#f97316', title: 'Filtres', desc: 'Déduplication sémantique et filtrage par conditions.' },
  { id: 'spotlights', icon: Sparkles, color: '#8b5cf6', title: 'Spotlights', desc: 'Surligner automatiquement les mots-clés dans vos articles.' },
  { id: 'digests', icon: Mail, color: '#42d3a5', title: 'Email Digests', desc: 'Résumés récurrents de vos feeds et dossiers par email.' },
  { id: 'opml', icon: Rss, color: '#f59e0b', title: 'OPML', desc: 'Importer/exporter vos sources au format OPML.' },
  { id: 'reports', icon: FileText, color: '#ec4899', title: 'Rapports', desc: 'Rapports automatisés générés à partir de vos articles.' },
] as const;

// ═══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
function SectionHeader({ icon: Icon, color, title, desc }: { icon: typeof Zap; color: string; title: string; desc: string }) {
  const { t } = useTheme();
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={20} style={{ color }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: t.textHeading }}>{title}</h2>
      </div>
      <p className="text-[13px]" style={{ color: t.textSecondary }}>{desc}</p>
    </div>
  );
}

function EmptyState({ text, buttonLabel, onAction }: { text: string; buttonLabel: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
      <p className="text-[13px] mb-4" style={{ color: t.textSecondary }}>{text}</p>
      <button onClick={onAction} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: t.accent }}>
        <Plus size={14} /> {buttonLabel}
      </button>
    </div>
  );
}

function ItemCard({ children, enabled, onToggle, onDelete, extra }: {
  children: React.ReactNode; enabled?: boolean; onToggle?: () => void; onDelete?: () => void; extra?: React.ReactNode;
}) {
  const { t } = useTheme();
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg group" style={{ background: t.bgCard, border: `1px solid ${t.border}`, opacity: enabled === false ? 0.5 : 1 }}>
      <div className="flex-1 min-w-0">{children}</div>
      <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {extra}
        {onToggle && (
          <button onClick={onToggle} title={enabled ? 'Désactiver' : 'Activer'}>
            {enabled ? <ToggleRight size={18} style={{ color: '#22c55e' }} /> : <ToggleLeft size={18} style={{ color: t.textSecondary }} />}
          </button>
        )}
        {onDelete && <button onClick={onDelete} title="Supprimer"><Trash2 size={15} style={{ color: '#ef4444' }} /></button>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const { t } = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className={`rounded-xl shadow-2xl overflow-hidden ${wide ? 'w-[720px]' : 'w-[520px]'} max-h-[85vh] flex flex-col`}
        style={{ background: t.bgApp, border: `1px solid ${t.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h3 className="text-[14px] font-bold" style={{ color: t.textHeading }}>{title}</h3>
          <button onClick={onClose}><X size={18} style={{ color: t.textSecondary }} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: t.textSecondary }}>{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTheme();
  return <input {...props} className={`w-full px-3 py-2 rounded-lg text-[13px] outline-none ${props.className || ''}`}
    style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary, ...props.style }} />;
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const { t } = useTheme();
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
      style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function BtnPrimary({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean }) {
  const { t } = useTheme();
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
      style={{ background: t.accent }}>
      {loading && <Loader2 size={14} className="animate-spin" />}{children}
    </button>
  );
}

function BtnSecondary({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const { t } = useTheme();
  return (
    <button onClick={onClick} className="px-4 py-2 rounded-lg text-[12px] font-semibold"
      style={{ color: t.textSecondary, border: `1px solid ${t.border}` }}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════
export default function AutomateView() {
  const { t } = useTheme();
  const [activeSection, setActiveSection] = useState('rules');

  return (
    <div className="flex h-full -m-5 overflow-hidden" style={{ background: t.bgApp }}>
      {/* Left sidebar */}
      <div className="w-72 shrink-0 overflow-y-auto py-4 px-3" style={{ borderRight: `1px solid ${t.border}`, background: t.bgSidebar }}>
        <h3 className="text-[13px] font-bold mb-4 px-2" style={{ color: t.textHeading }}>Automate</h3>
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors"
              style={{ background: activeSection === s.id ? t.bgCard : 'transparent', border: activeSection === s.id ? `1px solid ${t.border}` : '1px solid transparent' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${s.color}15` }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold" style={{ color: activeSection === s.id ? t.textHeading : t.textSecondary }}>{s.title}</div>
                <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: t.textSecondary }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === 'rules' && <RulesSection />}
        {activeSection === 'filters' && <FiltersSection />}
        {activeSection === 'spotlights' && <SpotlightsSection />}
        {activeSection === 'digests' && <DigestsSection />}
        {activeSection === 'opml' && <OpmlSection />}
        {activeSection === 'reports' && <ReportsSection />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 1. RULES SECTION
// ═══════════════════════════════════════════════════════════════
const CONDITION_FIELDS = [
  { value: 'keyword', label: 'Mot-clé', ops: ['contains', 'regex'] },
  { value: 'threat_level', label: 'Niveau de menace', ops: ['eq', 'gte', 'in'] },
  { value: 'country', label: 'Pays', ops: ['in'] },
  { value: 'theme', label: 'Thème', ops: ['eq', 'in'] },
  { value: 'source_id', label: 'Source', ops: ['eq', 'in'] },
  { value: 'sentiment', label: 'Sentiment', ops: ['eq'] },
  { value: 'criticality', label: 'Criticité', ops: ['eq'] },
  { value: 'lang', label: 'Langue', ops: ['eq'] },
  { value: 'tag', label: 'Tag', ops: ['contains'] },
  { value: 'person', label: 'Personne', ops: ['contains'] },
  { value: 'org', label: 'Organisation', ops: ['contains'] },
  { value: 'article_type', label: 'Type article', ops: ['eq'] },
];

const ACTION_TYPES = [
  { value: 'add_tag', label: 'Ajouter un tag', params: ['tag'] },
  { value: 'notify', label: 'Notifier', params: ['title'] },
  { value: 'webhook', label: 'Webhook', params: ['url'] },
  { value: 'add_to_case', label: 'Ajouter à un case', params: ['case_id'] },
  { value: 'suppress', label: 'Supprimer', params: [] },
  { value: 'mark_starred', label: 'Marquer favori', params: [] },
];

const OP_LABELS: Record<string, string> = {
  eq: '=', gte: '>=', in: 'dans', contains: 'contient', regex: 'regex', matched: 'correspond',
};

function RulesSection() {
  const { t } = useTheme();
  const [rules, setRules] = useState<RuleData[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editRule, setEditRule] = useState<RuleData | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; result: any } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, tmpl] = await Promise.all([listRules(), getRuleTemplates()]);
      setRules(r.rules);
      setTemplates(tmpl.templates);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string) => {
    const res = await toggleRule(id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: res.enabled } : r));
  };

  const handleDelete = async (id: string) => {
    await deleteRule(id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleTest = async (id: string) => {
    const result = await testRule(id);
    setTestResult({ id, result });
  };

  const handleCreateFromTemplate = (tmpl: any) => {
    setEditRule(null);
    setShowEditor(true);
    // Pre-fill is handled inside RuleEditorModal via initialData
    setTimeout(() => {
      // Set the template data — editor reads from window
      (window as any).__ruleTemplate = tmpl;
    }, 0);
  };

  return (
    <>
      <SectionHeader icon={Zap} color="#d4b85c" title="Rules" desc="Actions automatiques sur les articles entrants. Assigner des tags, notifier, webhooks." />

      <div className="flex items-center gap-3 mb-4">
        <BtnPrimary onClick={() => { setEditRule(null); (window as any).__ruleTemplate = null; setShowEditor(true); }}>
          <Plus size={14} /> Créer une rule
        </BtnPrimary>
        <span className="text-[12px]" style={{ color: t.textSecondary }}>{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: t.textSecondary }}>
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      ) : rules.length === 0 ? (
        <>
          <EmptyState text="Aucune rule configurée." buttonLabel="Créer une rule" onAction={() => setShowEditor(true)} />
          {templates.length > 0 && (
            <div className="mt-6 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textSecondary }}>Templates</h4>
              {templates.map((tmpl, i) => (
                <div key={i} onClick={() => handleCreateFromTemplate(tmpl)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:brightness-110 transition" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                  <Zap size={14} style={{ color: '#d4b85c' }} />
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold" style={{ color: t.textPrimary }}>{tmpl.name}</div>
                    <div className="text-[10px]" style={{ color: t.textSecondary }}>{tmpl.description}</div>
                  </div>
                  <ChevronRight size={14} style={{ color: t.textSecondary }} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <ItemCard key={rule.id} enabled={rule.enabled} onToggle={() => handleToggle(rule.id)} onDelete={() => handleDelete(rule.id)}
              extra={<>
                <button onClick={() => handleTest(rule.id)} title="Tester"><Play size={15} style={{ color: '#22c55e' }} /></button>
                <button onClick={() => { setEditRule(rule); setShowEditor(true); }} title="Modifier"><Settings size={15} style={{ color: t.textSecondary }} /></button>
              </>}>
              <div className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>{rule.name}</div>
              <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: t.textSecondary }}>
                <span>{rule.match_count} match{rule.match_count !== 1 ? 'es' : ''}</span>
                <span>·</span>
                <span>{rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}</span>
                {rule.last_matched_at && <><span>·</span><span>Last: {new Date(rule.last_matched_at).toLocaleDateString()}</span></>}
              </div>
            </ItemCard>
          ))}
          {templates.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
              <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: t.textSecondary }}>Templates</h4>
              <div className="flex flex-wrap gap-2">
                {templates.map((tmpl, i) => (
                  <button key={i} onClick={() => handleCreateFromTemplate(tmpl)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium hover:brightness-110 transition"
                    style={{ background: `${t.accent}15`, color: t.accent, border: `1px solid ${t.accent}30` }}>
                    + {tmpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {testResult && (
        <Modal title={`Test — ${testResult.result.matched_count}/${testResult.result.total_tested} articles matchés`} onClose={() => setTestResult(null)}>
          <div className="space-y-2">
            {testResult.result.sample_matches.map((m: any) => (
              <div key={m.id} className="px-3 py-2 rounded text-[12px]" style={{ background: t.bgCard, color: t.textPrimary }}>
                <span className="font-semibold">{m.title}</span>
                <span className="ml-2 text-[10px]" style={{ color: t.textSecondary }}>{m.source_id} · {m.threat_level}</span>
              </div>
            ))}
            {testResult.result.sample_matches.length === 0 && <p className="text-[12px]" style={{ color: t.textSecondary }}>Aucun article ne matche cette rule.</p>}
          </div>
        </Modal>
      )}

      {showEditor && <RuleEditorModal rule={editRule} onClose={() => { setShowEditor(false); setEditRule(null); }} onSaved={load} />}
    </>
  );
}

// ── Rule Editor Modal ───────────────────────────────────────
interface ConditionRow { field: string; op: string; value: string }

function RuleEditorModal({ rule, onClose, onSaved }: { rule: RuleData | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
  const tmpl = (window as any).__ruleTemplate;

  const [name, setName] = useState(rule?.name || tmpl?.name || '');
  const [description, setDescription] = useState(rule?.description || tmpl?.description || '');
  const [operator, setOperator] = useState<'AND' | 'OR'>(
    rule?.conditions?.operator || tmpl?.conditions?.operator || 'AND'
  );
  const [conditions, setConditions] = useState<ConditionRow[]>(() => {
    const src = rule?.conditions || tmpl?.conditions;
    if (src?.children) {
      return src.children.map((c: any) => ({
        field: c.field || '',
        op: c.op || 'eq',
        value: Array.isArray(c.value) ? c.value.join(', ') : String(c.value || ''),
      }));
    }
    return [{ field: 'threat_level', op: 'gte', value: 'high' }];
  });
  const [actions, setActions] = useState<{ type: string; params: Record<string, string> }[]>(() => {
    const src = rule?.actions || tmpl?.actions;
    if (Array.isArray(src) && src.length) return src.map((a: any) => ({ type: a.type, params: a.params || {} }));
    return [{ type: 'notify', params: { title: '' } }];
  });
  const [saving, setSaving] = useState(false);

  const addCondition = () => setConditions(prev => [...prev, { field: 'keyword', op: 'contains', value: '' }]);
  const removeCondition = (i: number) => setConditions(prev => prev.filter((_, j) => j !== i));
  const updateCondition = (i: number, patch: Partial<ConditionRow>) => setConditions(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c));

  const addAction = () => setActions(prev => [...prev, { type: 'add_tag', params: { tag: '' } }]);
  const removeAction = (i: number) => setActions(prev => prev.filter((_, j) => j !== i));

  const handleSave = async () => {
    setSaving(true);
    const condChildren = conditions.map(c => {
      let val: any = c.value;
      if (['in', 'country'].includes(c.op) || (c.field === 'country' && c.op === 'in')) {
        val = c.value.split(',').map(s => s.trim()).filter(Boolean);
      }
      return { type: 'condition', field: c.field, op: c.op, value: val };
    });
    const data = {
      name,
      description: description || null,
      conditions: { operator, children: condChildren },
      actions,
    };
    try {
      if (rule) await updateRule(rule.id, data);
      else await createRule(data);
      onSaved();
      onClose();
    } catch { /* empty */ }
    setSaving(false);
  };

  return (
    <Modal title={rule ? 'Modifier la rule' : 'Nouvelle rule'} onClose={onClose} wide>
      <FormField label="Nom">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Alerte menace critique" />
      </FormField>
      <FormField label="Description">
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optionnel" />
      </FormField>

      {/* Conditions */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: t.textSecondary }}>Conditions</span>
          <select value={operator} onChange={e => setOperator(e.target.value as 'AND' | 'OR')}
            className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ background: `${t.accent}20`, color: t.accent, border: 'none' }}>
            <option value="AND">ET (toutes)</option>
            <option value="OR">OU (au moins une)</option>
          </select>
        </div>
        <div className="space-y-2">
          {conditions.map((c, i) => {
            const fieldDef = CONDITION_FIELDS.find(f => f.value === c.field);
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                <select value={c.field} onChange={e => { updateCondition(i, { field: e.target.value, op: CONDITION_FIELDS.find(f => f.value === e.target.value)?.ops[0] || 'eq' }); }}
                  className="px-2 py-1 rounded text-[12px]" style={{ background: t.bgApp, color: t.textPrimary, border: `1px solid ${t.border}` }}>
                  {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={c.op} onChange={e => updateCondition(i, { op: e.target.value })}
                  className="px-2 py-1 rounded text-[12px]" style={{ background: t.bgApp, color: t.textPrimary, border: `1px solid ${t.border}` }}>
                  {(fieldDef?.ops || ['eq']).map(op => <option key={op} value={op}>{OP_LABELS[op] || op}</option>)}
                </select>
                <input value={c.value} onChange={e => updateCondition(i, { value: e.target.value })} placeholder="Valeur"
                  className="flex-1 px-2 py-1 rounded text-[12px] outline-none" style={{ background: t.bgApp, color: t.textPrimary, border: `1px solid ${t.border}` }} />
                <button onClick={() => removeCondition(i)}><X size={14} style={{ color: '#ef4444' }} /></button>
              </div>
            );
          })}
        </div>
        <button onClick={addCondition} className="mt-2 text-[11px] font-semibold flex items-center gap-1" style={{ color: t.accent }}>
          <Plus size={12} /> Ajouter une condition
        </button>
      </div>

      {/* Actions */}
      <div className="mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: t.textSecondary }}>Actions</span>
        <div className="space-y-2">
          {actions.map((a, i) => {
            const actionDef = ACTION_TYPES.find(at => at.value === a.type);
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                <select value={a.type} onChange={e => {
                  const newType = e.target.value;
                  const newDef = ACTION_TYPES.find(at => at.value === newType);
                  const newParams: Record<string, string> = {};
                  (newDef?.params || []).forEach(p => { newParams[p] = ''; });
                  setActions(prev => prev.map((aa, j) => j === i ? { type: newType, params: newParams } : aa));
                }} className="px-2 py-1 rounded text-[12px]" style={{ background: t.bgApp, color: t.textPrimary, border: `1px solid ${t.border}` }}>
                  {ACTION_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
                </select>
                {(actionDef?.params || []).map(p => (
                  <input key={p} value={a.params[p] || ''} onChange={e => {
                    const newParams = { ...a.params, [p]: e.target.value };
                    setActions(prev => prev.map((aa, j) => j === i ? { ...aa, params: newParams } : aa));
                  }} placeholder={p} className="flex-1 px-2 py-1 rounded text-[12px] outline-none"
                    style={{ background: t.bgApp, color: t.textPrimary, border: `1px solid ${t.border}` }} />
                ))}
                <button onClick={() => removeAction(i)}><X size={14} style={{ color: '#ef4444' }} /></button>
              </div>
            );
          })}
        </div>
        <button onClick={addAction} className="mt-2 text-[11px] font-semibold flex items-center gap-1" style={{ color: t.accent }}>
          <Plus size={12} /> Ajouter une action
        </button>
      </div>

      <div className="flex justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
        <BtnPrimary onClick={handleSave} loading={saving} disabled={!name.trim()}>
          {rule ? 'Enregistrer' : 'Créer'}
        </BtnPrimary>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. FILTERS SECTION
// ═══════════════════════════════════════════════════════════════
function FiltersSection() {
  const { t } = useTheme();
  const [dedupEnabled, setDedupEnabled] = useState(true);
  const [threshold, setThreshold] = useState(85);

  return (
    <>
      <SectionHeader icon={Filter} color="#f97316" title="Filtres" desc="Déduplication sémantique et filtrage automatique des articles redondants." />

      <div className="space-y-4">
        {/* Semantic dedup */}
        <div className="rounded-xl p-5" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[13px] font-bold" style={{ color: t.textHeading }}>Déduplication sémantique</h4>
              <p className="text-[11px] mt-0.5" style={{ color: t.textSecondary }}>
                Détecte les articles similaires de sources différentes (MiniLM + cosine similarity)
              </p>
            </div>
            <button onClick={() => setDedupEnabled(!dedupEnabled)}>
              {dedupEnabled ? <ToggleRight size={24} style={{ color: '#22c55e' }} /> : <ToggleLeft size={24} style={{ color: t.textSecondary }} />}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold" style={{ color: t.textSecondary }}>Seuil de similarité</span>
            <input type="range" min={50} max={99} value={threshold} onChange={e => setThreshold(+e.target.value)}
              className="flex-1 h-1 rounded-full appearance-none" style={{ background: t.border, accentColor: t.accent }} />
            <span className="text-[13px] font-bold w-10 text-right" style={{ color: t.accent }}>{threshold}%</span>
          </div>
          <p className="text-[10px] mt-2" style={{ color: t.textSecondary }}>
            Un seuil de 85% est recommandé. Plus le seuil est bas, plus d'articles seront détectés comme doublons.
          </p>
        </div>

        {/* Auto-suppression */}
        <div className="rounded-xl p-5" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <h4 className="text-[13px] font-bold mb-2" style={{ color: t.textHeading }}>Suppression automatique du bruit</h4>
          <p className="text-[11px] mb-3" style={{ color: t.textSecondary }}>
            Articles avec tag <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: t.bgApp }}>_suppressed</code> ou <code className="px-1 py-0.5 rounded text-[10px]" style={{ background: t.bgApp }}>_duplicate</code> sont masqués automatiquement.
          </p>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: t.textSecondary }}>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> Doublons tagués par la dédup</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Supprimés par les rules</div>
          </div>
        </div>

        {/* Dedup window */}
        <div className="rounded-xl p-5" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <h4 className="text-[13px] font-bold mb-2" style={{ color: t.textHeading }}>Fenêtre de comparaison</h4>
          <p className="text-[11px] mb-3" style={{ color: t.textSecondary }}>
            Les nouveaux articles sont comparés aux articles des dernières 48 heures.
          </p>
          <div className="flex items-center gap-3">
            <Clock size={14} style={{ color: t.accent }} />
            <span className="text-[12px] font-semibold" style={{ color: t.textPrimary }}>48 heures</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. SPOTLIGHTS SECTION
// ═══════════════════════════════════════════════════════════════
const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#d4b85c'];

function SpotlightsSection() {
  const { t } = useTheme();
  const [spotlights, setSpotlights] = useState<SpotlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editSpotlight, setEditSpotlight] = useState<SpotlightData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSpotlights((await listSpotlights()).spotlights); } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (s: SpotlightData) => {
    await updateSpotlight(s.id, { enabled: !s.enabled });
    setSpotlights(prev => prev.map(sp => sp.id === s.id ? { ...sp, enabled: !sp.enabled } : sp));
  };

  const handleDelete = async (id: string) => {
    await deleteSpotlight(id);
    setSpotlights(prev => prev.filter(s => s.id !== id));
  };

  return (
    <>
      <SectionHeader icon={Sparkles} color="#8b5cf6" title="Spotlights" desc="Colorier automatiquement les mots-clés dans vos articles pour une lecture rapide." />

      <div className="flex items-center gap-3 mb-4">
        <BtnPrimary onClick={() => { setEditSpotlight(null); setShowEditor(true); }}>
          <Plus size={14} /> Créer un spotlight
        </BtnPrimary>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: t.textSecondary }}>
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      ) : spotlights.length === 0 ? (
        <>
          <EmptyState text="Aucun spotlight configuré." buttonLabel="Créer un spotlight" onAction={() => setShowEditor(true)} />
          <div className="mt-6 rounded-xl p-5" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
            <h4 className="text-[12px] font-bold mb-3" style={{ color: t.textHeading }}>Exemple</h4>
            <p className="text-[13px] leading-relaxed" style={{ color: t.textSecondary }}>
              Les pays comme la <span className="px-1 rounded" style={{ background: '#d4b85c20', color: '#d4b85c' }}>France</span> et
              l'<span className="px-1 rounded" style={{ background: '#ef444420', color: '#ef4444' }}>Iran</span> sont au centre des discussions sur
              le <span className="px-1 rounded" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>nucléaire</span> civil.
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {spotlights.map(s => (
            <ItemCard key={s.id} enabled={s.enabled} onToggle={() => handleToggle(s)} onDelete={() => handleDelete(s.id)}
              extra={<button onClick={() => { setEditSpotlight(s); setShowEditor(true); }} title="Modifier"><Settings size={15} style={{ color: t.textSecondary }} /></button>}>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>{s.name}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {s.keywords.map((k, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: `${s.color}20`, color: s.color }}>{k}</span>
                ))}
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {showEditor && (
        <SpotlightEditorModal spotlight={editSpotlight} onClose={() => { setShowEditor(false); setEditSpotlight(null); }} onSaved={load} />
      )}
    </>
  );
}

function SpotlightEditorModal({ spotlight, onClose, onSaved }: { spotlight: SpotlightData | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
  const [name, setName] = useState(spotlight?.name || '');
  const [keywords, setKeywords] = useState(spotlight?.keywords.join(', ') || '');
  const [color, setColor] = useState(spotlight?.color || '#ef4444');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const kws = keywords.split(',').map(k => k.trim()).filter(Boolean);
    try {
      if (spotlight) await updateSpotlight(spotlight.id, { name, keywords: kws, color });
      else await createSpotlight({ name, keywords: kws, color });
      onSaved();
      onClose();
    } catch { /* empty */ }
    setSaving(false);
  };

  return (
    <Modal title={spotlight ? 'Modifier le spotlight' : 'Nouveau spotlight'} onClose={onClose}>
      <FormField label="Nom du groupe">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Pays prioritaires" />
      </FormField>
      <FormField label="Mots-clés (séparés par des virgules)">
        <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="France, Iran, nucléaire" />
      </FormField>
      <FormField label="Couleur">
        <div className="flex items-center gap-2">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full border-2 transition"
              style={{ background: c, borderColor: color === c ? '#fff' : 'transparent' }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer" />
        </div>
      </FormField>

      {/* Preview */}
      {keywords && (
        <div className="rounded-lg p-4 mb-4" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: t.textSecondary }}>Aperçu</span>
          <p className="text-[13px]" style={{ color: t.textSecondary }}>
            {keywords.split(',').map((k, i) => (
              <span key={i}>{i > 0 && ' · '}<span className="px-1 rounded" style={{ background: `${color}20`, color }}>{k.trim()}</span></span>
            ))}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
        <BtnPrimary onClick={handleSave} loading={saving} disabled={!name.trim() || !keywords.trim()}>
          {spotlight ? 'Enregistrer' : 'Créer'}
        </BtnPrimary>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. DIGESTS SECTION
// ═══════════════════════════════════════════════════════════════
function DigestsSection() {
  const { t } = useTheme();
  const [digests, setDigests] = useState<DigestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editDigest, setEditDigest] = useState<DigestData | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDigests((await listDigests()).digests); } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string) => {
    const res = await toggleDigest(id);
    setDigests(prev => prev.map(d => d.id === id ? { ...d, enabled: res.enabled } : d));
  };

  const handleDelete = async (id: string) => {
    await deleteDigest(id);
    setDigests(prev => prev.filter(d => d.id !== id));
  };

  const handlePreview = async (id: string) => {
    const res = await previewDigest(id);
    setPreviewHtml(res.html);
  };

  const FREQ_LABELS: Record<string, string> = { daily: 'Quotidien', weekly: 'Hebdomadaire', hourly: 'Horaire' };

  return (
    <>
      <SectionHeader icon={Mail} color="#42d3a5" title="Email Digests" desc="Résumés récurrents de vos articles par email." />

      <div className="flex items-center gap-3 mb-4">
        <BtnPrimary onClick={() => { setEditDigest(null); setShowEditor(true); }}><Plus size={14} /> Créer un digest</BtnPrimary>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: t.textSecondary }}>
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      ) : digests.length === 0 ? (
        <EmptyState text="Aucun digest configuré." buttonLabel="Créer un digest" onAction={() => setShowEditor(true)} />
      ) : (
        <div className="space-y-2">
          {digests.map(d => (
            <ItemCard key={d.id} enabled={d.enabled} onToggle={() => handleToggle(d.id)} onDelete={() => handleDelete(d.id)}
              extra={<>
                <button onClick={() => handlePreview(d.id)} title="Aperçu"><Eye size={15} style={{ color: t.textSecondary }} /></button>
                <button onClick={() => { setEditDigest(d); setShowEditor(true); }} title="Modifier"><Settings size={15} style={{ color: t.textSecondary }} /></button>
              </>}>
              <div className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>{d.name}</div>
              <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: t.textSecondary }}>
                <span>{FREQ_LABELS[d.frequency] || d.frequency}</span>
                <span>·</span>
                <span>{d.recipients.length} destinataire{d.recipients.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{d.scope_type}</span>
                {d.last_sent_at && <><span>·</span><span>Dernier: {new Date(d.last_sent_at).toLocaleDateString()}</span></>}
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {previewHtml && (
        <Modal title="Aperçu du digest" onClose={() => setPreviewHtml(null)} wide>
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff' }}>
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </Modal>
      )}

      {showEditor && <DigestEditorModal digest={editDigest} onClose={() => { setShowEditor(false); setEditDigest(null); }} onSaved={load} />}
    </>
  );
}

function DigestEditorModal({ digest, onClose, onSaved }: { digest: DigestData | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
  const [name, setName] = useState(digest?.name || '');
  const [recipients, setRecipients] = useState(digest?.recipients.join(', ') || '');
  const [scopeType, setScopeType] = useState(digest?.scope_type || 'all');
  const [frequency, setFrequency] = useState(digest?.frequency || 'daily');
  const [sendHour, setSendHour] = useState(digest?.send_hour ?? 8);
  const [minThreat, setMinThreat] = useState(digest?.min_threat || '');
  const [maxArticles, setMaxArticles] = useState(digest?.max_articles ?? 20);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      name,
      recipients: recipients.split(',').map(r => r.trim()).filter(Boolean),
      scope_type: scopeType,
      frequency,
      send_hour: sendHour,
      min_threat: minThreat || null,
      max_articles: maxArticles,
    };
    try {
      if (digest) await updateDigest(digest.id, data);
      else await createDigest(data);
      onSaved();
      onClose();
    } catch { /* empty */ }
    setSaving(false);
  };

  return (
    <Modal title={digest ? 'Modifier le digest' : 'Nouveau digest'} onClose={onClose}>
      <FormField label="Nom"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Digest quotidien" /></FormField>
      <FormField label="Destinataires (emails séparés par virgule)"><Input value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="email@example.com" /></FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Scope">
          <Select value={scopeType} onChange={setScopeType} options={[
            { value: 'all', label: 'Tous les articles' },
            { value: 'folder', label: 'Dossier' },
            { value: 'case', label: 'Case' },
            { value: 'feed', label: 'Feed' },
          ]} />
        </FormField>
        <FormField label="Fréquence">
          <Select value={frequency} onChange={setFrequency} options={[
            { value: 'daily', label: 'Quotidien' },
            { value: 'weekly', label: 'Hebdomadaire' },
            { value: 'hourly', label: 'Horaire' },
          ]} />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Heure d'envoi (UTC)">
          <Input type="number" min={0} max={23} value={sendHour} onChange={e => setSendHour(+e.target.value)} />
        </FormField>
        <FormField label="Menace minimum">
          <Select value={minThreat} onChange={setMinThreat} options={[
            { value: '', label: 'Aucun filtre' },
            { value: 'low', label: 'Low+' },
            { value: 'medium', label: 'Medium+' },
            { value: 'high', label: 'High+' },
            { value: 'critical', label: 'Critical' },
          ]} />
        </FormField>
        <FormField label="Max articles">
          <Input type="number" min={1} max={100} value={maxArticles} onChange={e => setMaxArticles(+e.target.value)} />
        </FormField>
      </div>
      <div className="flex justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
        <BtnPrimary onClick={handleSave} loading={saving} disabled={!name.trim()}>
          {digest ? 'Enregistrer' : 'Créer'}
        </BtnPrimary>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. OPML SECTION
// ═══════════════════════════════════════════════════════════════
function OpmlSection() {
  const { t } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; feeds: any[] } | null>(null);
  const [subUrl, setSubUrl] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportOpml();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'worldmonitor-feeds.opml'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* empty */ }
    setExporting(false);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const res = await importOpml(file);
      setResult(res);
    } catch { /* empty */ }
    setImporting(false);
  };

  const handleSubscribe = async () => {
    if (!subUrl.trim()) return;
    setSubscribing(true);
    try {
      const res = await (await import('@/v2/lib/api')).subscribeOpml(subUrl);
      setResult(res);
      setSubUrl('');
    } catch { /* empty */ }
    setSubscribing(false);
  };

  return (
    <>
      <SectionHeader icon={Rss} color="#f59e0b" title="OPML" desc="Importer et exporter vos sources au format OPML standard." />

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Import */}
        <div className="rounded-xl p-5 cursor-pointer hover:brightness-110 transition" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
          onClick={() => fileRef.current?.click()}>
          <div className="flex items-center gap-3 mb-3">
            <Upload size={20} style={{ color: '#f59e0b' }} />
            <h4 className="text-[13px] font-bold" style={{ color: t.textHeading }}>Importer OPML</h4>
          </div>
          <p className="text-[11px]" style={{ color: t.textSecondary }}>
            Charger un fichier .opml pour importer toutes vos sources RSS.
          </p>
          {importing && <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: t.accent }}><Loader2 size={12} className="animate-spin" /> Import en cours...</div>}
          <input ref={fileRef} type="file" accept=".opml,.xml" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImport(e.target.files[0]); }} />
        </div>

        {/* Export */}
        <div className="rounded-xl p-5 cursor-pointer hover:brightness-110 transition" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}
          onClick={handleExport}>
          <div className="flex items-center gap-3 mb-3">
            <Download size={20} style={{ color: '#f59e0b' }} />
            <h4 className="text-[13px] font-bold" style={{ color: t.textHeading }}>Exporter OPML</h4>
          </div>
          <p className="text-[11px]" style={{ color: t.textSecondary }}>
            Télécharger toutes vos sources au format OPML pour backup ou migration.
          </p>
          {exporting && <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: t.accent }}><Loader2 size={12} className="animate-spin" /> Export...</div>}
        </div>
      </div>

      {/* Subscribe to remote OPML */}
      <div className="rounded-xl p-5 mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
        <h4 className="text-[13px] font-bold mb-2" style={{ color: t.textHeading }}>S'abonner à un OPML distant</h4>
        <p className="text-[11px] mb-3" style={{ color: t.textSecondary }}>
          Importer les feeds depuis une URL OPML publique.
        </p>
        <div className="flex items-center gap-2">
          <Input value={subUrl} onChange={e => setSubUrl(e.target.value)} placeholder="https://example.com/feeds.opml" style={{ flex: 1 }} />
          <BtnPrimary onClick={handleSubscribe} loading={subscribing} disabled={!subUrl.trim()}>Importer</BtnPrimary>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-xl p-5" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3 mb-3">
            <Check size={16} style={{ color: '#22c55e' }} />
            <h4 className="text-[13px] font-bold" style={{ color: t.textHeading }}>
              {result.imported} importé{result.imported !== 1 ? 's' : ''}, {result.skipped} ignoré{result.skipped !== 1 ? 's' : ''}
            </h4>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {result.feeds.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: t.textPrimary }}>
                {f.status === 'imported' ? <Check size={12} style={{ color: '#22c55e' }} /> : <X size={12} style={{ color: t.textSecondary }} />}
                <span className="truncate">{f.name}</span>
                <span className="text-[10px] shrink-0" style={{ color: t.textSecondary }}>{f.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// 6. REPORTS SECTION
// ═══════════════════════════════════════════════════════════════
function ReportsSection() {
  const { t } = useTheme();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editReport, setEditReport] = useState<ReportData | null>(null);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReports((await listReports()).reports); } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string) => {
    const res = await toggleReport(id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, enabled: res.enabled } : r));
  };

  const handleDelete = async (id: string) => {
    await deleteReport(id);
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const handleGenerate = async (id: string) => {
    setGenerating(id);
    try {
      const res = await generateReport(id);
      setGeneratedContent(res.content);
    } catch { /* empty */ }
    setGenerating(null);
  };

  return (
    <>
      <SectionHeader icon={FileText} color="#ec4899" title="Rapports automatisés" desc="Rapports récurrents générés à partir du contenu de vos feeds." />

      <div className="flex items-center gap-3 mb-4">
        <BtnPrimary onClick={() => { setEditReport(null); setShowEditor(true); }}><Plus size={14} /> Créer un rapport</BtnPrimary>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center" style={{ color: t.textSecondary }}>
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      ) : reports.length === 0 ? (
        <EmptyState text="Aucun rapport configuré." buttonLabel="Créer un rapport" onAction={() => setShowEditor(true)} />
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <ItemCard key={r.id} enabled={r.enabled} onToggle={() => handleToggle(r.id)} onDelete={() => handleDelete(r.id)}
              extra={<>
                <button onClick={() => handleGenerate(r.id)} title="Générer maintenant" disabled={generating === r.id}>
                  {generating === r.id ? <Loader2 size={15} className="animate-spin" style={{ color: t.accent }} /> : <Play size={15} style={{ color: '#22c55e' }} />}
                </button>
                <button onClick={() => { setEditReport(r); setShowEditor(true); }} title="Modifier"><Settings size={15} style={{ color: t.textSecondary }} /></button>
              </>}>
              <div className="text-[13px] font-semibold" style={{ color: t.textPrimary }}>{r.name}</div>
              <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: t.textSecondary }}>
                <span>{r.frequency}</span>
                <span>·</span>
                <span>{r.scope_type}</span>
                <span>·</span>
                <span>{r.format}</span>
                {r.last_generated_at && <><span>·</span><span>Dernier: {new Date(r.last_generated_at).toLocaleDateString()}</span></>}
              </div>
            </ItemCard>
          ))}
        </div>
      )}

      {generatedContent && (
        <Modal title="Rapport généré" onClose={() => setGeneratedContent(null)} wide>
          <pre className="whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: t.textPrimary }}>{generatedContent}</pre>
        </Modal>
      )}

      {showEditor && <ReportEditorModal report={editReport} onClose={() => { setShowEditor(false); setEditReport(null); }} onSaved={load} />}
    </>
  );
}

function ReportEditorModal({ report, onClose, onSaved }: { report: ReportData | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTheme();
  const [name, setName] = useState(report?.name || '');
  const [scopeType, setScopeType] = useState(report?.scope_type || 'all');
  const [frequency, setFrequency] = useState(report?.frequency || 'daily');
  const [format, setFormat] = useState(report?.format || 'markdown');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (report) await updateReport(report.id, { name, scope_type: scopeType, frequency, format });
      else await createReport({ name, scope_type: scopeType, frequency, format });
      onSaved();
      onClose();
    } catch { /* empty */ }
    setSaving(false);
  };

  return (
    <Modal title={report ? 'Modifier le rapport' : 'Nouveau rapport'} onClose={onClose}>
      <FormField label="Nom"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Rapport quotidien menaces" /></FormField>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Scope">
          <Select value={scopeType} onChange={setScopeType} options={[
            { value: 'all', label: 'Tous' },
            { value: 'folder', label: 'Dossier' },
            { value: 'case', label: 'Case' },
            { value: 'feed', label: 'Feed' },
          ]} />
        </FormField>
        <FormField label="Fréquence">
          <Select value={frequency} onChange={setFrequency} options={[
            { value: 'daily', label: 'Quotidien' },
            { value: 'weekly', label: 'Hebdomadaire' },
          ]} />
        </FormField>
        <FormField label="Format">
          <Select value={format} onChange={setFormat} options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'html', label: 'HTML' },
          ]} />
        </FormField>
      </div>
      <div className="flex justify-end gap-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
        <BtnPrimary onClick={handleSave} loading={saving} disabled={!name.trim()}>
          {report ? 'Enregistrer' : 'Créer'}
        </BtnPrimary>
      </div>
    </Modal>
  );
}
