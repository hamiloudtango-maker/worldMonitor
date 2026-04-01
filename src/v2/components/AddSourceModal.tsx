// src/v2/components/AddSourceModal.tsx
// Inoreader-style: tabbed source type selector with dark theme
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X, Search, Loader2, Rss, Globe, Send, AtSign, Cloud,
  MessageCircle, Plus, FolderPlus, Check, FileText,
  Mail, Headphones, Upload, Eye, Newspaper,
} from 'lucide-react';
import { detectSource, addSource, listFolders, createFolder, importOpml, type DetectedSource, type FolderData } from '@/v2/lib/sources-api';
import { useTheme } from '@/v2/lib/theme';


/* ── Source types ── */
interface SourceTab {
  id: string;
  label: string;
  icon: typeof Rss;
  placeholder: string;
  hint: string;
}

const SOURCE_TABS: SourceTab[] = [
  { id: 'web-feed',   label: 'Web feed',       icon: Rss,            placeholder: 'https://example.com/feed.xml', hint: 'URL d\u2019un flux RSS ou Atom' },
  { id: 'website',    label: 'Site Web',        icon: Globe,          placeholder: 'https://example.com', hint: 'On d\u00e9tecte automatiquement les flux RSS du site' },
  { id: 'google-news',label: 'Google News',     icon: Newspaper,      placeholder: 'Mot-cl\u00e9 ou sujet (ex: intelligence artificielle)', hint: 'Cr\u00e9e un flux \u00e0 partir de Google News' },
  { id: 'bluesky',    label: 'Bluesky',         icon: Cloud,          placeholder: '@user.bsky.social', hint: 'Profil ou feed Bluesky' },
  { id: 'facebook',   label: 'Page Facebook',   icon: MessageCircle,  placeholder: 'https://facebook.com/page', hint: 'URL d\u2019une page publique' },
  { id: 'telegram',   label: 'Canal Telegram',  icon: Send,           placeholder: 'https://t.me/channel ou @channel', hint: 'Canal Telegram public' },
  { id: 'newsletter', label: 'Newsletter',      icon: Mail,           placeholder: 'email@newsletters.example.com', hint: 'Adresse email de la newsletter' },
  { id: 'import',     label: 'Importer OPML',   icon: Upload,         placeholder: '', hint: 'Importez vos abonnements depuis un fichier OPML' },
  { id: 'watch',      label: 'Flux de veille',  icon: Eye,            placeholder: 'https://example.com/page-to-watch', hint: 'Surveille les changements d\u2019une page web' },
  { id: 'podcast',    label: 'Podcast',         icon: Headphones,     placeholder: 'https://podcast.example.com/feed', hint: 'URL du flux podcast RSS' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddSourceModal({ open, onClose, onAdded }: Props) {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState('web-feed');
  const [url, setUrl] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedSource | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [opmlContent, setOpmlContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tab = SOURCE_TABS.find(st => st.id === activeTab)!;

  useEffect(() => {
    if (open) {
      setUrl(''); setDetected(null); setAdded(false); setError('');
      setSelectedFolder(''); setOpmlContent('');
      setTimeout(() => inputRef.current?.focus(), 100);
      listFolders().then(d => setFolders(d.folders)).catch(() => {});
    }
  }, [open]);

  // Reset form when switching tabs
  useEffect(() => {
    setUrl(''); setDetected(null); setAdded(false); setError(''); setOpmlContent('');
  }, [activeTab]);

  const handleDetect = useCallback(async () => {
    if (!url.trim()) return;
    setDetecting(true); setError(''); setDetected(null);
    try {
      // For Google News, construct the RSS URL
      let detectUrl = url.trim();
      if (activeTab === 'google-news') {
        detectUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(detectUrl)}&hl=fr&gl=FR&ceid=FR:fr`;
      }
      const result = await detectSource(detectUrl);
      setDetected(result);
    } catch (e: any) {
      setError(e.message || 'Impossible de d\u00e9tecter cette source');
    } finally {
      setDetecting(false);
    }
  }, [url, activeTab]);

  const handleAdd = useCallback(async () => {
    if (!detected) return;
    setAdding(true); setError('');
    try {
      let folderId = selectedFolder;
      if (showNewFolder && newFolderName.trim()) {
        const f = await createFolder({ name: newFolderName.trim() });
        folderId = f.id;
      }
      await addSource({ type: detected.type, config: detected.config, name: detected.name, folder_id: folderId || undefined });
      setAdded(true);
      onAdded?.();
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setError(typeof e.message === 'string' ? e.message : JSON.stringify(e.message));
    } finally {
      setAdding(false);
    }
  }, [detected, selectedFolder, showNewFolder, newFolderName, onAdded, onClose]);

  const handleOpmlImport = useCallback(async () => {
    if (!opmlContent) return;
    setAdding(true); setError('');
    try {
      await importOpml(opmlContent);
      setAdded(true);
      onAdded?.();
      setTimeout(onClose, 1500);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\u2019import');
    } finally {
      setAdding(false);
    }
  }, [opmlContent, onAdded, onClose]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setOpmlContent(reader.result as string);
    reader.readAsText(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { if (!detected) handleDetect(); else handleAdd(); }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div className="fixed top-[8vh] left-1/2 -translate-x-1/2 w-full max-w-[680px] rounded-2xl shadow-2xl z-[61] overflow-hidden"
        style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: `1px solid ${t.border}` }}>
          <h2 className="text-[15px] font-bold" style={{ color: t.textHeading }}>Ajouter</h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: t.textSecondary }}><X size={16} /></button>
        </div>

        <div className="flex" style={{ minHeight: 400 }}>
          {/* Left — Tabs */}
          <div className="w-[180px] shrink-0 py-2 overflow-y-auto" style={{ borderRight: `1px solid ${t.border}` }}>
            {SOURCE_TABS.map(t => {
              const isActive = t.id === activeTab;
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors"
                  style={{ background: isActive ? `${t.accent}15` : 'transparent', color: isActive ? t.accent : t.textSecondary }}
                  onMouseOver={e => { if (!isActive) e.currentTarget.style.background = `${t.accent}08`; }}
                  onMouseOut={e => { if (!isActive) e.currentTarget.style.background = isActive ? `${t.accent}15` : 'transparent'; }}
                >
                  <Icon size={15} />
                  <span className="text-[12px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right — Form */}
          <div className="flex-1 p-5 overflow-y-auto">
            {activeTab === 'import' ? (
              /* ── OPML Import ── */
              <div className="space-y-4">
                <p className="text-[13px]" style={{ color: t.textPrimary }}>{tab.hint}</p>
                <input ref={fileRef} type="file" accept=".opml,.xml" onChange={handleFileSelect} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-[13px] font-medium transition-colors"
                  style={{ border: `2px dashed ${t.border}`, color: t.accent }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = t.accent; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = t.border; }}
                >
                  <Upload size={18} />
                  {opmlContent ? 'Fichier charg\u00e9 \u2713' : 'Choisir un fichier OPML'}
                </button>
                {opmlContent && (
                  <button onClick={handleOpmlImport} disabled={adding}
                    className="w-full py-2.5 text-[13px] font-semibold text-white rounded-xl flex items-center justify-center gap-2"
                    style={{ background: t.accent }}>
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Importer
                  </button>
                )}
              </div>
            ) : (
              /* ── Standard URL input ── */
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold mb-2 block" style={{ color: t.textSecondary }}>{tab.label}</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: t.textSecondary }} />
                      <input ref={inputRef} type="text" value={url}
                        onChange={e => { setUrl(e.target.value); setDetected(null); setAdded(false); setError(''); }}
                        onKeyDown={handleKeyDown}
                        placeholder={tab.placeholder}
                        className="w-full pl-10 pr-4 py-2.5 text-[13px] rounded-xl outline-none"
                        style={{ background: t.bgApp, border: `1px solid ${t.border}`, color: t.textPrimary }}
                      />
                    </div>
                    <button onClick={handleDetect} disabled={detecting || !url.trim()}
                      className="px-4 py-2.5 text-[12px] font-semibold text-white rounded-xl shrink-0 disabled:opacity-40"
                      style={{ background: t.accent }}>
                      {detecting ? <Loader2 size={14} className="animate-spin" /> : 'D\u00e9tecter'}
                    </button>
                  </div>
                  <p className="text-[10px] mt-1.5 px-1" style={{ color: t.textSecondary }}>{tab.hint}</p>
                </div>

                {/* Detection result */}
                {detected && !added && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: t.bgApp, border: `1px solid ${t.border}` }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${t.accent}15` }}>
                        <tab.icon size={20} style={{ color: t.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: t.textHeading }}>{detected.name}</p>
                        <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: t.textSecondary }}>{detected.type}</p>
                      </div>
                      <Check size={16} style={{ color: '#22c55e' }} />
                    </div>

                    {/* Folder selector */}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: t.textSecondary }}>
                        Dossier (optionnel)
                      </label>
                      {!showNewFolder ? (
                        <div className="flex items-center gap-2">
                          <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}
                            className="flex-1 text-[12px] px-3 py-2 rounded-lg outline-none"
                            style={{ background: t.bgApp, border: `1px solid ${t.border}`, color: t.textPrimary }}>
                            <option value="">Sans dossier</option>
                            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                          <button onClick={() => setShowNewFolder(true)}
                            className="p-2 rounded-lg transition-colors" style={{ color: t.textSecondary, border: `1px solid ${t.border}` }} title="Nouveau dossier">
                            <FolderPlus size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                            placeholder="Nom du dossier..." autoFocus
                            className="flex-1 text-[12px] px-3 py-2 rounded-lg outline-none"
                            style={{ background: t.bgApp, border: `1px solid ${t.border}`, color: t.textPrimary }} />
                          <button onClick={() => setShowNewFolder(false)} className="p-2 rounded-lg" style={{ color: t.textSecondary }}>
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <button onClick={handleAdd} disabled={adding}
                      className="w-full py-2.5 text-[13px] font-semibold text-white rounded-xl flex items-center justify-center gap-2"
                      style={{ background: t.accent }}>
                      {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Ajouter cette source
                    </button>
                  </div>
                )}

                {/* Success */}
                {added && (
                  <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#0f2d1a', border: '1px solid #22c55e30' }}>
                    <Check size={20} style={{ color: '#22c55e' }} />
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: '#22c55e' }}>Source ajout\u00e9e</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#4ade80' }}>{detected?.name}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3">
                <p className="text-[12px] px-3 py-2 rounded-lg" style={{ color: '#ef4444', background: '#2d1515', border: '1px solid #ef444430' }}>{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
