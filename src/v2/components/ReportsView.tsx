/**
 * ReportsView — notebook-style report viewer.
 *
 * Layout:
 *   Left (w-72):  Sources tree — cases/feeds/URLs used in selected report
 *   Center:       Markdown rendered view (report or article content)
 *   Right (w-64): Wizard buttons + saved reports list
 */
import { useState, useEffect, useMemo } from 'react';
import {
  FolderOpen, Globe, Rss, Sparkles,
  Loader2, Copy, Check, Download, Plus, Trash2,
  ChevronDown, ChevronRight, ExternalLink, FileText,
} from 'lucide-react';
import { api, listCases } from '@/v2/lib/api';
import type { CaseData } from '@/v2/lib/api';
import { listFeeds } from '@/v2/lib/ai-feeds-api';
import type { AIFeedData } from '@/v2/lib/ai-feeds-api';
import { timeAgo } from '@/v2/lib/constants';
import { useTheme } from '@/v2/lib/theme';

const ACCENT = '#42d3a5';
const STORAGE_KEY = 'wm-saved-reports';

// ── Types ─────────────────────────────────────────────────────
interface SourceArticle { title: string; url: string; threat: string; source: string }
interface SourceGroup { name: string; type?: string; articles: SourceArticle[] }
interface ReportSources { cases: SourceGroup[]; feeds: SourceGroup[] }

interface SavedReport {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  markdown: string;
  sources: ReportSources;
}

interface ReportType {
  key: string;
  title: string;
  icon: typeof FolderOpen;
  needsCase?: boolean;
  needsFeed?: boolean;
  needsPrompt?: boolean;
}

const REPORT_TYPES: ReportType[] = [
  { key: 'case-summary', title: 'Resume de Cases', icon: FolderOpen, needsCase: true },
  { key: 'all-cases', title: 'Resume article/article', icon: Globe },
  { key: 'feed-debrief', title: 'Debrief Feed', icon: Rss, needsFeed: true },
  { key: 'custom-analysis', title: 'Analyse custom', icon: Sparkles, needsPrompt: true, needsCase: true, needsFeed: true },
];

// ── Markdown renderer (basic) ─────────────────────────────────
function renderMarkdown(md: string, t: { textPrimary: string; textSecondary: string; border: string }): string {
  return md
    .replace(/^### (.+)$/gm, `<h3 class="text-sm font-bold mt-4 mb-2" style="color:${t.textPrimary}">$1</h3>`)
    .replace(/^## (.+)$/gm, `<h2 class="text-base font-bold mt-6 mb-2 pb-1" style="color:${t.textPrimary};border-bottom:1px solid ${t.border}">$1</h2>`)
    .replace(/^# (.+)$/gm, `<h1 class="text-lg font-bold mt-6 mb-3" style="color:${t.textPrimary}">$1</h1>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong class="font-semibold" style="color:${t.textPrimary}">$1</strong>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#42d3a5] hover:underline">$1</a>')
    .replace(/^\d+\.\s+(.+)$/gm, `<li class="ml-4 text-[13px] leading-relaxed list-decimal mb-1" style="color:${t.textSecondary}">$1</li>`)
    .replace(/^- (.+)$/gm, `<li class="ml-4 text-[13px] leading-relaxed list-disc mb-1" style="color:${t.textSecondary}">$1</li>`)
    .replace(/^---$/gm, `<hr class="my-4" style="border-color:${t.border}">`)
    .replace(/\n\n/g, `</p><p class="text-[13px] leading-relaxed mb-3" style="color:${t.textSecondary}">`)
    .replace(/\n/g, '<br>')
    .replace(/^/, `<p class="text-[13px] leading-relaxed mb-3" style="color:${t.textSecondary}">`)
    .replace(/$/, '</p>');
}

// ── Persistence ───────────────────────────────────────────────
function loadReports(): SavedReport[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveReports(reports: SavedReport[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

// ── Main component ────────────────────────────────────────────
export default function ReportsView() {
  const { t } = useTheme();
  const [reports, setReports] = useState<SavedReport[]>(loadReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centerContent, setCenterContent] = useState<{ type: 'report' | 'article'; markdown: string; title: string; articleId?: string } | null>(null);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<ReportType | null>(null);
  const [cases, setCases] = useState<CaseData[]>([]);
  const [feeds, setFeeds] = useState<AIFeedData[]>([]);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [selectedFeedIds, setSelectedFeedIds] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  // Source tree expand state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const selected = useMemo(() => reports.find(r => r.id === selectedId) || null, [reports, selectedId]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listCases().then(setCases).catch(() => {});
    listFeeds().then(d => setFeeds(d.feeds)).catch(() => {});
  }, []);

  // When selecting a report, show it in center
  useEffect(() => {
    if (selected) {
      setCenterContent({ type: 'report', markdown: selected.markdown, title: selected.title });
      // Expand all source groups
      const groups = new Set<string>();
      selected.sources.cases.forEach(c => groups.add(`case-${c.name}`));
      selected.sources.feeds.forEach(f => groups.add(`feed-${f.name}`));
      setExpandedGroups(groups);
    }
  }, [selectedId]);

  function deleteReport(id: string) {
    const next = reports.filter(r => r.id !== id);
    setReports(next);
    saveReports(next);
    if (selectedId === id) { setSelectedId(null); setCenterContent(null); }
  }

  // ── Wizard ──────────────────────────────────────────────────
  function openWizard(type: ReportType) {
    setSelectedCaseIds([]);
    setSelectedFeedIds([]);
    setCustomPrompt('');
    // No config needed: generate directly
    if (!type.needsCase && !type.needsFeed && !type.needsPrompt) {
      setWizardType(type);
      setWizardOpen(false);
      generate_direct(type);
      return;
    }
    setWizardType(type);
    setWizardOpen(true);
  }

  async function generate_direct(type: ReportType) {
    setGenerating(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 180_000);
      const res = await api<{ report: string; sources: ReportSources }>('/cases/report', {
        method: 'POST',
        body: JSON.stringify({ type: type.key, case_ids: cases.map(c => c.id), feed_ids: [], prompt: '' }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const title = type.title + ' — ' + new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const newReport: SavedReport = {
        id: crypto.randomUUID(), title, type: type.key,
        createdAt: new Date().toISOString(),
        markdown: res.report,
        sources: res.sources || { cases: [], feeds: [] },
      };
      const next = [newReport, ...reports];
      setReports(next);
      saveReports(next);
      setSelectedId(newReport.id);
    } catch (err) {
      alert(`Erreur: ${err}`);
    }
    setGenerating(false);
  }

  async function generate() {
    if (!wizardType) return;
    setGenerating(true);

    let caseIds: string[] = [];
    let type = wizardType.key;

    if (wizardType.key === 'case-summary') caseIds = selectedCaseIds;
    else if (wizardType.key === 'all-cases') caseIds = cases.map(c => c.id);
    else if (wizardType.key === 'feed-debrief') caseIds = [];
    else if (wizardType.key === 'custom-analysis') caseIds = selectedCaseIds;

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 180_000);
      const res = await api<{ report: string; sources: ReportSources }>('/cases/report', {
        method: 'POST',
        body: JSON.stringify({ type, case_ids: caseIds, feed_ids: selectedFeedIds, prompt: customPrompt }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const title = wizardType.title + ' — ' + new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const newReport: SavedReport = {
        id: crypto.randomUUID(),
        title,
        type: wizardType.key,
        createdAt: new Date().toISOString(),
        markdown: res.report,
        sources: res.sources || { cases: [], feeds: [] },
      };

      const next = [newReport, ...reports];
      setReports(next);
      saveReports(next);
      setSelectedId(newReport.id);
      setWizardOpen(false);
      setWizardType(null);
    } catch (err) {
      alert(`Erreur: ${err}`);
    }
    setGenerating(false);
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function viewArticle(url: string, title: string) {
    setCenterContent({ type: 'article', markdown: `# ${title}\n\nChargement...`, title });
    try {
      const res = await api<{ articles: any[] }>(`/articles/v1/search?q=${encodeURIComponent(title.slice(0, 40))}&limit=1`);
      if (res.articles?.[0]) {
        const a = res.articles[0];
        // Fetch scraped content (field is content_md from backend)
        const scraped = await api<{ content_md: string | null; url: string; title: string }>(`/articles/v1/${a.id}/content`).catch(() => null);
        const body = scraped?.content_md || a.summary || 'Pas de contenu disponible.';
        const header = `# ${a.title}\n\n**Source:** ${a.source_id} | **Date:** ${a.pub_date || ''} | **Menace:** ${a.threat_level || 'info'}\n\n---\n\n`;
        const footer = a.link ? `\n\n---\n\n[Ouvrir l'article original](${a.link})` : '';
        setCenterContent({ type: 'article', markdown: header + body + footer, title: a.title, articleId: a.id });
      } else {
        setCenterContent({ type: 'article', markdown: `# ${title}\n\nArticle non trouve en base.\n\n[Ouvrir](${url})`, title });
      }
    } catch {
      setCenterContent({ type: 'article', markdown: `# ${title}\n\n[Ouvrir l'article](${url})`, title });
    }
  }

  function copyReport() {
    if (!centerContent) return;
    navigator.clipboard.writeText(centerContent.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadReport() {
    if (!centerContent) return;
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([centerContent.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const THREAT_DOT: Record<string, string> = {
    critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500', info: 'bg-[#3a4f63]',
  };

  // ── Wizard modal ────────────────────────────────────────────
  // Wizard is now inline in the center panel — no modal needed

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex h-full -m-5 rounded-xl border overflow-hidden" style={{ background: t.bgCard, borderColor: `${t.border}99` }}>

      {/* ── LEFT: Wizard grid + report list ── */}
      <div className="w-56 border-r flex flex-col shrink-0" style={{ borderColor: `${t.border}99`, background: t.bgCard }}>
        {/* Wizard grid */}
        <div className="p-2 border-b" style={{ borderColor: t.border }}>
          <div className="grid grid-cols-2 gap-2">
            {REPORT_TYPES.map(rt => (
              <button key={rt.key} onClick={() => openWizard(rt)} disabled={generating}
                className="flex flex-col items-center justify-center gap-1.5 p-3 aspect-square rounded-xl border hover:border-[#42d3a5]/40 hover:bg-[#42d3a5]/5 transition-all group disabled:opacity-50" style={{ borderColor: t.border }}>
                {generating && wizardType?.key === rt.key
                  ? <Loader2 size={20} className="text-[#42d3a5] animate-spin" />
                  : <rt.icon size={20} className="group-hover:text-[#42d3a5]" style={{ color: t.textSecondary }} />
                }
                <span className="text-[10px] font-semibold group-hover:text-[#42d3a5] text-center leading-tight" style={{ color: t.textSecondary }}>{rt.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Report list */}
        <div className="px-2.5 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: t.textSecondary }}>Rapports ({reports.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {reports.map(r => (
            <div key={r.id}
              className={`flex items-start gap-2 px-2.5 py-2 border-b cursor-pointer transition-colors ${
                selectedId === r.id ? 'bg-[#42d3a5]/5 border-l-2 border-l-[#42d3a5]' : 'hover:bg-[#162230]'
              }`} style={{ borderBottomColor: `${t.border}80` }}
              onClick={() => setSelectedId(r.id)}>
              <FileText size={12} className={selectedId === r.id ? 'text-[#42d3a5] mt-0.5' : 'text-[#3a4f63] mt-0.5'} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium truncate" style={{ color: t.textSecondary }}>{r.title}</div>
                <div className="text-[9px]" style={{ color: t.textSecondary }}>{timeAgo(r.createdAt)}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); deleteReport(r.id); }}
                className="p-0.5 text-[#3a4f63] hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100">
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="text-center text-[10px] py-6" style={{ color: t.textSecondary }}>Aucun rapport</div>
          )}
        </div>
      </div>

      {/* ── CENTER: Markdown viewer ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {centerContent ? (
          <>
            <div className="px-4 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: t.border }}>
              <div className="flex items-center gap-2 min-w-0">
                {centerContent.type === `article` && selected && (
                  <button onClick={() => setCenterContent({ type: `report`, markdown: selected.markdown, title: selected.title })}
                    className="text-[11px] text-[#42d3a5] hover:underline shrink-0">Rapport</button>
                )}
                <span className="text-[11px] font-medium truncate" style={{ color: t.textSecondary }}>{centerContent.title}</span>
              </div>
              <div className="flex gap-1.5">
                <button onClick={copyReport} className="p-1.5 hover:text-[#42d3a5] rounded" style={{ color: t.textSecondary }} title="Copier">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
                <button onClick={downloadReport} className="p-1.5 hover:text-[#42d3a5] rounded" style={{ color: t.textSecondary }} title="Telecharger">
                  <Download size={13} />
                </button>
                {centerContent.type === 'article' && centerContent.articleId && (
                  <button onClick={async () => {
                    await api(`/articles/v1/${centerContent.articleId}/content`, { method: 'DELETE' }).catch(() => {});
                    setCenterContent(prev => prev ? { ...prev, markdown: prev.markdown + '\n\n---\n\n*Cache supprime. Le prochain affichage re-scrapera l\'article.*' } : null);
                  }} className="p-1.5 hover:text-red-400 rounded" style={{ color: t.textSecondary }} title="Supprimer le cache scrape">
                    <Trash2 size={13} />
                  </button>
                )}
                {centerContent.type === `report` && selectedId && (
                  <button onClick={() => deleteReport(selectedId)}
                    className="p-1.5 hover:text-red-400 rounded" style={{ color: t.textSecondary }} title="Supprimer le rapport">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(centerContent.markdown, t) }} />
            </div>
          </>
        ) : generating ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="animate-spin text-[#42d3a5]" />
            <p className="text-sm font-medium" style={{ color: t.textSecondary }}>Generation du rapport...</p>
            <p className="text-[11px]" style={{ color: t.textSecondary }}>Analyse des articles et redaction en cours</p>
          </div>
        ) : wizardOpen && wizardType ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-md p-6">
              <h3 className="text-base font-bold mb-4" style={{ color: t.textPrimary }}>{wizardType.title}</h3>

              {wizardType.needsCase && (
                <div className="mb-4">
                  <label className="block text-[11px] font-medium mb-1.5" style={{ color: t.textSecondary }}>Cases {selectedCaseIds.length > 0 && <span className="text-[#42d3a5]">({selectedCaseIds.length})</span>}</label>
                  <div className="border rounded-xl max-h-40 overflow-y-auto" style={{ borderColor: t.border }}>
                    {cases.map(c => (
                      <label key={c.id} className={`flex items-center gap-2.5 px-3 py-2 text-[12px] cursor-pointer border-b last:border-0 ${selectedCaseIds.includes(c.id) ? 'bg-emerald-500/10' : 'hover:bg-[#162230]'}`} style={{ borderColor: `${t.border}80` }}>
                        <input type="checkbox" checked={selectedCaseIds.includes(c.id)}
                          onChange={() => setSelectedCaseIds(p => p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id])}
                          className="rounded text-[#42d3a5]" style={{ borderColor: t.border }} />
                        <span className="flex-1" style={{ color: t.textSecondary }}>{c.name}</span>
                        <span className="text-[10px]" style={{ color: t.textSecondary }}>{c.article_count} art.</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {wizardType.needsFeed && (
                <div className="mb-4">
                  <label className="block text-[11px] font-medium mb-1.5" style={{ color: t.textSecondary }}>Feeds {selectedFeedIds.length > 0 && <span className="text-[#42d3a5]">({selectedFeedIds.length})</span>}</label>
                  <div className="border rounded-xl max-h-40 overflow-y-auto" style={{ borderColor: t.border }}>
                    {feeds.map(f => (
                      <label key={f.id} className={`flex items-center gap-2.5 px-3 py-2 text-[12px] cursor-pointer border-b last:border-0 ${selectedFeedIds.includes(f.id) ? 'bg-violet-500/10' : 'hover:bg-[#162230]'}`} style={{ borderColor: `${t.border}80` }}>
                        <input type="checkbox" checked={selectedFeedIds.includes(f.id)}
                          onChange={() => setSelectedFeedIds(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])}
                          className="rounded text-[#42d3a5]" style={{ borderColor: t.border }} />
                        <span className="flex-1" style={{ color: t.textSecondary }}>{f.name}</span>
                        <span className="text-[10px]" style={{ color: t.textSecondary }}>{f.result_count} art.</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {wizardType.needsPrompt && (
                <div className="mb-4">
                  <label className="block text-[11px] font-medium mb-1.5" style={{ color: t.textSecondary }}>Prompt</label>
                  <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3}
                    placeholder="Ex: Analyse les risques lies a l`energie nucleaire..."
                    className="w-full px-3 py-2 text-[12px] border rounded-xl focus:outline-none focus:border-[#42d3a5] resize-none" style={{ borderColor: t.border }} />
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setWizardOpen(false)}
                  className="flex-1 py-2.5 text-[12px] border rounded-xl hover:bg-[#162230]" style={{ color: t.textSecondary, borderColor: t.border }}>Annuler</button>
                <button onClick={generate}
                  disabled={generating ||
                    (wizardType.key === 'case-summary' && !selectedCaseIds.length) ||
                    (wizardType.key === 'feed-debrief' && !selectedFeedIds.length) ||
                    (wizardType.key === 'custom-analysis' && (!customPrompt.trim() || (!selectedCaseIds.length && !selectedFeedIds.length)))
                  }
                  className="flex-1 py-2.5 text-[12px] font-semibold text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
                  style={{ background: ACCENT }}>
                  <Sparkles size={14} /> Generer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-xs">
              <FileText size={36} className="mx-auto text-[#3a4f63] mb-4" />
              <p className="text-sm font-medium mb-1" style={{ color: t.textSecondary }}>Rapports d`intelligence</p>
              <p className="text-[11px] leading-relaxed" style={{ color: t.textSecondary }}>
                {reports.length > 0
                  ? 'Selectionnez un rapport ou creez-en un nouveau.'
                  : 'Cliquez sur un bouton pour generer votre premier rapport.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Source tree ── */}
      <div className="w-72 border-l flex flex-col shrink-0" style={{ borderColor: `${t.border}99`, background: t.bgCard }}>
        <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: t.border }}>
          <h3 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: t.textSecondary }}>Sources</h3>
          {centerContent?.type === `article` && selected && (
            <button onClick={() => setCenterContent({ type: 'report', markdown: selected.markdown, title: selected.title })}
              className="text-[10px] text-[#42d3a5] hover:underline">Rapport</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {!selected ? (
            <div className="text-center text-[10px] py-8" style={{ color: t.textSecondary }}>Selectionnez un rapport</div>
          ) : (
            <div className="space-y-0.5">
              {selected.sources.cases.map(c => {
                const key = `case-${c.name}`;
                const open = expandedGroups.has(key);
                return (
                  <div key={key}>
                    <button onClick={() => toggleGroup(key)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left rounded-lg hover:bg-[#162230]">
                      {open ? <ChevronDown size={11} style={{ color: t.textSecondary }} /> : <ChevronRight size={11} style={{ color: t.textSecondary }} />}
                      <FolderOpen size={11} className="text-[#42d3a5]" />
                      <span className="text-[10px] font-semibold flex-1 truncate" style={{ color: t.textSecondary }}>{c.name}</span>
                      <span className="text-[8px]" style={{ color: t.textSecondary }}>{c.articles.length}</span>
                    </button>
                    {open && (
                      <div className="ml-5 space-y-0.5">
                        {c.articles.map((a, i) => (
                          <button key={i} onClick={() => viewArticle(a.url, a.title)}
                            className="w-full flex items-center gap-1.5 px-1.5 py-1 text-left rounded hover:bg-[#162230] group">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${THREAT_DOT[a.threat] || THREAT_DOT.info}`} />
                            <span className="text-[9px] truncate group-hover:text-[#42d3a5]" style={{ color: t.textSecondary }}>{a.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {selected.sources.feeds.map(f => {
                const key = `feed-${f.name}`;
                const open = expandedGroups.has(key);
                return (
                  <div key={key}>
                    <button onClick={() => toggleGroup(key)}
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left rounded-lg hover:bg-[#162230]">
                      {open ? <ChevronDown size={11} style={{ color: t.textSecondary }} /> : <ChevronRight size={11} style={{ color: t.textSecondary }} />}
                      <Rss size={11} className="text-violet-500" />
                      <span className="text-[10px] font-semibold flex-1 truncate" style={{ color: t.textSecondary }}>{f.name}</span>
                      <span className="text-[8px]" style={{ color: t.textSecondary }}>{f.articles.length}</span>
                    </button>
                    {open && (
                      <div className="ml-5 space-y-0.5">
                        {f.articles.map((a, i) => (
                          <button key={i} onClick={() => viewArticle(a.url, a.title)}
                            className="w-full flex items-center gap-1.5 px-1.5 py-1 text-left rounded hover:bg-[#162230] group">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${THREAT_DOT[a.threat] || THREAT_DOT.info}`} />
 <span className="text-[9px] truncate group-hover:text-[#42d3a5]" style={{ color: t.textSecondary }}>{a.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {selected.sources.cases.length === 0 && selected.sources.feeds.length === 0 && (
 <div className="text-center text-[9px] py-4" style={{ color: t.textSecondary }}>Pas de sources</div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
