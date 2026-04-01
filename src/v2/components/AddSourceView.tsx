// src/v2/components/AddSourceView.tsx
// Inoreader-style full-page "Ajouter" view with source type sidebar
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, Loader2, Rss, Globe, Send, Cloud,
  MessageCircle, Plus, FolderPlus, Check, X,
  Mail, Headphones, Upload, Eye, Newspaper, FileText, Info,
} from 'lucide-react';
import { detectSource, addSource, listFolders, createFolder, importOpml, type DetectedSource, type FolderData } from '@/v2/lib/sources-api';
import { useTheme } from '@/v2/lib/theme';


/* ── Source types ── */
interface SourceTab {
  id: string;
  label: string;
  icon: typeof Rss;
  title: string;
  placeholder: string;
  hint: string;
}

const SOURCE_TABS: SourceTab[] = [
  { id: 'website',     label: 'Site Web',         icon: Globe,          title: 'Suivez des sites web',                placeholder: 'Rechercher un site Web ou coller l\’URL RSS', hint: 'On d\étecte automatiquement les flux RSS du site' },
  { id: 'web-feed',    label: 'Web feed',         icon: Rss,            title: 'Ajouter un flux RSS/Atom',            placeholder: 'Coller l\’URL du flux RSS ou Atom', hint: 'URL directe du flux' },
  { id: 'track',       label: 'Track changes',    icon: Eye,            title: 'Surveiller les changements',          placeholder: 'URL de la page \à surveiller', hint: 'Recevez une alerte quand le contenu change' },
  { id: 'google-news', label: 'Google News',      icon: Newspaper,      title: 'Suivre via Google News',              placeholder: 'Mot-cl\é, sujet ou nom (ex: intelligence artificielle)', hint: 'Cr\ée un flux \à partir de Google News' },
  { id: 'bluesky',     label: 'Flux Bluesky',     icon: Cloud,          title: 'Suivre un flux Bluesky',              placeholder: '@utilisateur.bsky.social', hint: 'Profil ou feed Bluesky' },
  { id: 'facebook',    label: 'Page Facebook',    icon: MessageCircle,  title: 'Suivre une page Facebook',            placeholder: 'https://facebook.com/page', hint: 'URL d\’une page publique Facebook' },
  { id: 'telegram',    label: 'Canal Telegram',   icon: Send,           title: 'Suivre un canal Telegram',            placeholder: '@canal ou https://t.me/canal', hint: 'Canal Telegram public' },
  { id: 'newsletter',  label: 'Newsletter',       icon: Mail,           title: 'S\’abonner \à une newsletter', placeholder: 'email@newsletter.example.com', hint: 'Adresse email de la newsletter' },
  { id: 'import',      label: 'Importer des flux', icon: Upload,        title: 'Importer vos abonnements',            placeholder: '', hint: 'Importez depuis un fichier OPML (Feedly, Inoreader, etc.)' },
  { id: 'watch',       label: 'Flux de veille',   icon: FileText,       title: 'Cr\éer un flux de veille',        placeholder: 'Mot-cl\é ou expression \à surveiller', hint: 'Agrège les résultats de veille automatiquement' },
  { id: 'podcast',     label: 'Podcast',          icon: Headphones,     title: 'Suivre un podcast',                   placeholder: 'URL du flux podcast ou nom du podcast', hint: 'Flux RSS du podcast' },
];

/* ── Collections vedettes (for "Site Web" tab) ── */
const COLLECTIONS = [
  { label: 'Top News',          color: '#6366f1' },
  { label: 'Tech & IA',         color: '#8b5cf6' },
  { label: 'Business & Finance', color: '#3b82f6' },
  { label: 'G\éopolitique',  color: '#0ea5e9' },
  { label: 'S\écurit\é & D\éfense', color: '#ef4444' },
  { label: 'Science',           color: '#22c55e' },
  { label: 'Afrique & Moyen-Orient', color: '#f59e0b' },
  { label: 'Sport',             color: '#06b6d4' },
];

export default function AddSourceView() {
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState('website');
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
    listFolders().then(d => setFolders(d.folders)).catch(() => {});
  }, []);

  useEffect(() => {
    setUrl(''); setDetected(null); setAdded(false); setError(''); setOpmlContent('');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeTab]);

  const handleDetect = useCallback(async () => {
    if (!url.trim()) return;
    setDetecting(true); setError(''); setDetected(null);
    try {
      let detectUrl = url.trim();
      if (activeTab === 'google-news') {
        detectUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(detectUrl)}&hl=fr&gl=FR&ceid=FR:fr`;
      }
      const result = await detectSource(detectUrl);
      setDetected(result);
    } catch (e: any) {
      setError(e.message || 'Impossible de d\étecter cette source');
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
    } catch (e: any) {
      setError(typeof e.message === 'string' ? e.message : JSON.stringify(e.message));
    } finally {
      setAdding(false);
    }
  }, [detected, selectedFolder, showNewFolder, newFolderName]);

  const handleOpmlImport = useCallback(async () => {
    if (!opmlContent) return;
    setAdding(true); setError('');
    try {
      await importOpml(opmlContent);
      setAdded(true);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\’import');
    } finally {
      setAdding(false);
    }
  }, [opmlContent]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setOpmlContent(reader.result as string);
    reader.readAsText(file);
  };

  return (
    <div className="flex h-full" style={{ background: t.bgApp }}>
      {/* ── Left sidebar: source type tabs ── */}
      <div className="w-[190px] shrink-0 py-4 overflow-y-auto" style={{ borderRight: `1px solid ${t.border}` }}>
        <h6 className="text-[11px] font-bold uppercase tracking-wider px-4 mb-3" style={{ color: t.textSecondary }}>Ajouter</h6>
        {SOURCE_TABS.map(t => {
          const isActive = t.id === activeTab;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors"
              style={{ background: isActive ? `${t.accent}12` : 'transparent', color: isActive ? t.accent : t.textSecondary }}
              onMouseOver={e => { if (!isActive) e.currentTarget.style.background = `${t.accent}08`; }}
              onMouseOut={e => { if (!isActive) e.currentTarget.style.background = isActive ? `${t.accent}12` : 'transparent'; }}
            >
              <Icon size={14} />
              <span className="text-[12px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Right: content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <h2 className="text-[22px] font-bold mb-6" style={{ color: t.textHeading }}>{tab.title}</h2>

        {/* ── IMPORT tab ── */}
        {activeTab === 'import' && (
          <div className="max-w-2xl">
            <input ref={fileRef} type="file" accept=".opml,.xml,.zip,.gz" onChange={handleFileSelect} className="hidden" />
            {/* Drag & drop zone — exact Inoreader style */}
            <div className="rounded-xl p-8 flex flex-col items-center" style={{ border: `2px dashed ${t.border}` }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = t.accent; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = t.border; }}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = t.border; const f = e.dataTransfer.files[0]; if (f) { const r = new FileReader(); r.onload = () => setOpmlContent(r.result as string); r.readAsText(f); } }}>
              <p className="text-[15px] font-semibold mb-5" style={{ color: t.textHeading }}>Importer depuis</p>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium"
                  style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }}>
                  <FileText size={14} /> Appareil
                </button>
                <button onClick={() => { const u = prompt('URL du fichier OPML :'); if (u) setUrl(u); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium"
                  style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }}>
                  <Globe size={14} /> URL
                </button>
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium"
                  style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: '#22c55e' }}>
                  <Rss size={14} /> Feedly
                </button>
              </div>
              <p className="text-[12px]" style={{ color: t.textSecondary }}>
                ou glisser-d\époser votre fichier ici (*.zip, *.gz, *.xml, *.opml)
              </p>
            </div>
            {opmlContent && (
              <button onClick={handleOpmlImport} disabled={adding}
                className="w-full mt-4 py-3 text-[14px] font-semibold text-white rounded-xl flex items-center justify-center gap-2"
                style={{ background: t.accent }}>
                {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Importer les abonnements
              </button>
            )}
          </div>
        )}

        {/* ── All other tabs: search bar + tab-specific content ── */}
        {activeTab !== 'import' && (
          <div className="max-w-2xl space-y-6">
            {/* Search bar — adapts per tab type */}
            {(activeTab === 'web-feed' || activeTab === 'track') ? (
              /* Web feed & Track changes: input + "Charger" button */
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center rounded-xl overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                  <div className="flex items-center gap-2 flex-1 px-4">
                    <Search size={16} style={{ color: t.textSecondary }} />
                    <input ref={inputRef} type="text" value={url}
                      onChange={e => { setUrl(e.target.value); setDetected(null); setAdded(false); setError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleDetect(); }}
                      placeholder={tab.placeholder}
                      className="flex-1 py-3.5 text-[14px] bg-transparent outline-none" style={{ color: t.textPrimary }} />
                  </div>
                </div>
                <button onClick={handleDetect} disabled={detecting || !url.trim()}
                  className="px-5 py-3 text-[13px] font-medium rounded-xl shrink-0 transition-colors disabled:opacity-40"
                  style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textPrimary; }}>
                  {detecting ? <Loader2 size={14} className="animate-spin" /> : (activeTab === 'web-feed' ? 'Charger le site web' : 'Charger la page Web')}
                </button>
              </div>
            ) : activeTab === 'watch' ? (
              /* Flux de veille: source dropdown + search + filter + add button */
              <div className="flex items-center rounded-xl overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                <select className="px-3 py-3.5 text-[12px] outline-none border-r font-medium" style={{ background: t.bgCard, borderColor: t.border, color: t.textPrimary }}>
                  <option>Fil d'actualit\é</option>
                </select>
                <div className="flex items-center gap-2 flex-1 px-4">
                  <Search size={16} style={{ color: t.textSecondary }} />
                  <input ref={inputRef} type="text" value={url}
                    onChange={e => { setUrl(e.target.value); setDetected(null); setAdded(false); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleDetect(); }}
                    placeholder="Tapez pour commencer votre recherche"
                    className="flex-1 py-3.5 text-[14px] bg-transparent outline-none" style={{ color: t.textPrimary }} />
                </div>
                <button className="px-3 py-3.5 border-l" style={{ borderColor: t.border, color: t.textSecondary }}><Search size={14} /></button>
                <button className="px-3 py-3.5 border-l" style={{ borderColor: t.border, color: t.accent }}><Plus size={16} /></button>
              </div>
            ) : (
              /* Standard: search input + optional dropdowns */
              <div className="flex items-center rounded-xl overflow-hidden" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                <div className="flex items-center gap-2 flex-1 px-4">
                  <Search size={16} style={{ color: t.textSecondary }} />
                  <input ref={inputRef} type="text" value={url}
                    onChange={e => { setUrl(e.target.value); setDetected(null); setAdded(false); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { if (!detected) handleDetect(); else handleAdd(); } }}
                    placeholder={tab.placeholder}
                    className="flex-1 py-3.5 text-[14px] bg-transparent outline-none" style={{ color: t.textPrimary }} />
                </div>
                {activeTab === 'google-news' && (
                  <select className="px-3 py-3.5 text-[12px] outline-none border-l" style={{ background: t.bgCard, borderColor: t.border, color: t.textSecondary }}>
                    <option>Tous les sites web</option>
                    <option>Actualit\és</option>
                    <option>Blogs</option>
                  </select>
                )}
                {(activeTab === 'website' || activeTab === 'google-news') && (
                  <select className="px-3 py-3.5 text-[12px] outline-none border-l" style={{ background: t.bgCard, borderColor: t.border, color: t.textSecondary }}>
                    <option>Toutes les langues</option>
                    <option value="fr">Fran\çais</option>
                    <option value="en">English</option>
                    <option value="ar">\ا\ل\ع\ر\ب\ي\ة</option>
                    <option value="es">Espa\ñol</option>
                    <option value="de">Deutsch</option>
                  </select>
                )}
              </div>
            )}

            {/* ── Tab-specific content below search bar ── */}
            {!detected && !added && (
              <>
                {/* Site Web: collections vedettes */}
                {activeTab === 'website' && !url && (
                  <div>
                    <h4 className="text-[14px] font-semibold mb-4" style={{ color: t.textPrimary }}>
                      Vous ne savez pas par où commencer ? Explorez nos collections vedettes :
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                      {COLLECTIONS.map(c => (
                        <button key={c.label} className="relative h-24 rounded-xl overflow-hidden text-left" style={{ background: c.color }}
                          onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; }} onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}>
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.1), rgba(0,0,0,0.4))' }} />
                          <span className="absolute bottom-3 left-3 text-[13px] font-bold text-white">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Google News: search tips with examples */}
                {activeTab === 'google-news' && !url && (
                  <div className="space-y-5">
                    <h4 className="text-[16px] font-bold" style={{ color: t.textHeading }}>Rechercher plus intelligemment</h4>
                    {[
                      { tip: 'Utilisez des guillemets pour une correspondance exacte des noms', ex: '"Nikola Tesla"' },
                      { tip: 'Utilisez "intitle:" pour rechercher des mots-cl\és dans les titres', ex: 'intitle:"electric vehicles"' },
                      { tip: 'Utilisez "-" pour exclure des mots-cl\és sp\écifiques', ex: '"Nikola Tesla" -experiment' },
                      { tip: 'Utilisez "AND" pour rechercher plusieurs mots-cl\és', ex: '"Nikola Tesla" AND experiment' },
                      { tip: 'Utilisez "OR" pour combiner plusieurs mots-cl\és', ex: '"Nikola Tesla" OR "Thomas Edison"' },
                    ].map((item, i) => (
                      <div key={i}>
                        <p className="text-[12px] mb-1.5" style={{ color: t.textPrimary }}>{item.tip}</p>
                        <button onClick={() => setUrl(item.ex)}
                          className="inline-block px-3 py-1.5 rounded-md text-[12px] font-mono transition-colors"
                          style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.accent }}
                          onMouseOver={e => { e.currentTarget.style.borderColor = t.accent; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = t.border; }}>
                          {item.ex}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Telegram: illustration + description */}
                {activeTab === 'telegram' && !url && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-40 h-40 rounded-full flex items-center justify-center mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                      <Send size={48} style={{ color: '#0088cc' }} />
                    </div>
                    <p className="text-[14px] text-center max-w-md" style={{ color: t.textPrimary }}>
                      Suivez vos canaux Telegram pr\éf\ér\és directement dans WorldMonitor. Collez l'URL d'un canal public ou son @username.
                    </p>
                  </div>
                )}

                {/* Bluesky: illustration */}
                {activeTab === 'bluesky' && !url && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-40 h-40 rounded-full flex items-center justify-center mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                      <Cloud size={48} style={{ color: '#0085ff' }} />
                    </div>
                    <p className="text-[14px] text-center max-w-md" style={{ color: t.textPrimary }}>
                      Suivez des profils et feeds Bluesky. Entrez un handle (@user.bsky.social) ou l'URL d'un feed.
                    </p>
                  </div>
                )}

                {/* Facebook: illustration */}
                {activeTab === 'facebook' && !url && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-40 h-40 rounded-full flex items-center justify-center mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                      <MessageCircle size={48} style={{ color: '#1877f2' }} />
                    </div>
                    <p className="text-[14px] text-center max-w-md" style={{ color: t.textPrimary }}>
                      Suivez les publications de pages Facebook publiques. Collez l'URL de la page.
                    </p>
                  </div>
                )}

                {/* Newsletter: illustration */}
                {activeTab === 'newsletter' && !url && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-40 h-40 rounded-full flex items-center justify-center mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                      <Mail size={48} style={{ color: '#f59e0b' }} />
                    </div>
                    <p className="text-[14px] text-center max-w-md" style={{ color: t.textPrimary }}>
                      D\ésencombrez votre bo\îte de r\éception en recevant vos newsletters directement dans WorldMonitor.
                    </p>
                  </div>
                )}

                {/* Podcast: illustration */}
                {activeTab === 'podcast' && !url && (
                  <div className="flex flex-col items-center py-8">
                    <div className="w-40 h-40 rounded-full flex items-center justify-center mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                      <Headphones size={48} style={{ color: '#8b5cf6' }} />
                    </div>
                    <p className="text-[14px] text-center max-w-md" style={{ color: t.textPrimary }}>
                      Suivez vos podcasts pr\éf\ér\és via leur flux RSS. Recherchez par nom ou collez l'URL du flux.
                    </p>
                  </div>
                )}

                {/* Web feed: 3-step guide */}
                {activeTab === 'web-feed' && !url && (
                  <div className="space-y-6">
                    {[
                      { n: 1, text: 'Collez l\’URL d\’un site Web et cliquez sur "Charger le site Web".', ex: 'https://bbc.com' },
                      { n: 2, text: 'S\électionnez les \él\éments du site Web pour g\én\érer un flux.', ex: null },
                      { n: 3, text: 'Pr\évisualisez et suivez votre nouveau flux.', ex: null },
                    ].map(step => (
                      <div key={step.n} className="flex items-start gap-4">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold" style={{ background: `${t.accent}20`, color: t.accent }}>{step.n}</div>
                        <div>
                          <p className="text-[13px]" style={{ color: t.textPrimary }}>{step.text}</p>
                          {step.ex && (
                            <button onClick={() => setUrl(step.ex!)} className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-mono"
                              style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}>
                              <Search size={12} /> {step.ex}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <a href="#" className="text-[12px] font-medium" style={{ color: t.accent }}>What is a Web feed?</a>
                  </div>
                )}

                {/* Track changes: 3-step guide */}
                {activeTab === 'track' && !url && (
                  <div className="space-y-6">
                    {[
                      { n: 1, text: 'Collez l\’URL de la page Web et cliquez sur "Charger la page Web".', ex: 'https://bbc.com' },
                      { n: 2, text: 'S\électionnez la zone de la page Web que vous souhaitez suivre.', ex: null },
                      { n: 3, text: 'D\éfinissez vos pr\éf\érences et cliquez sur "Suivre le flux".', ex: null },
                    ].map(step => (
                      <div key={step.n} className="flex items-start gap-4">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold" style={{ background: `${t.accent}20`, color: t.accent }}>{step.n}</div>
                        <div>
                          <p className="text-[13px]" style={{ color: t.textPrimary }}>{step.text}</p>
                          {step.ex && (
                            <button onClick={() => setUrl(step.ex!)} className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-mono"
                              style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary }}>
                              <Search size={12} /> {step.ex}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <a href="#" className="text-[12px] font-medium" style={{ color: t.accent }}>What is a Track changes feed?</a>
                  </div>
                )}

                {/* Podcast: search tips with examples */}
                {activeTab === 'podcast' && !url && (
                  <div className="space-y-5">
                    <h4 className="text-[16px] font-bold" style={{ color: t.textHeading }}>Rechercher plus intelligemment</h4>
                    <div>
                      <p className="text-[12px] mb-1.5" style={{ color: t.textPrimary }}>D\écouvrez des podcasts en saisissant un mot-cl\é</p>
                      <button onClick={() => setUrl('The Wirecutter Show')} className="inline-block px-3 py-1.5 rounded-md text-[12px] font-mono"
                        style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.accent }}>
                        The Wirecutter Show
                      </button>
                    </div>
                    <div>
                      <p className="text-[12px] mb-1.5" style={{ color: t.textPrimary }}>Suivez les podcasts en collant leur URL</p>
                      <button onClick={() => setUrl('https://feeds.simplecast.com/XT57_IN')} className="inline-block px-3 py-1.5 rounded-md text-[12px] font-mono"
                        style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.accent }}>
                        https://feeds.simplecast.com/XT57_IN
                      </button>
                    </div>
                  </div>
                )}

                {/* Flux de veille: article search with scope tabs */}
                {activeTab === 'watch' && !url && (
                  <div className="flex flex-col items-center py-6">
                    <div className="flex items-center gap-4 mb-8 self-start">
                      <button className="text-[12px] font-semibold pb-1" style={{ color: t.accent, borderBottom: `2px solid ${t.accent}` }}>DANS VOTRE COMPTE</button>
                      <button className="text-[12px] font-semibold pb-1" style={{ color: t.textSecondary }}>DANS TOUS LES FLUX PUBLICS</button>
                    </div>
                    <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                      <Search size={40} style={{ color: t.accent, opacity: 0.5 }} />
                    </div>
                    <p className="text-[15px] font-semibold mb-2" style={{ color: t.textHeading }}>Recherchez des articles dans vos flux</p>
                    <p className="text-[13px] text-center max-w-md" style={{ color: t.textSecondary }}>
                      Explorez des articles depuis des sources que vous suivez. Convertissez vos recherches en flux de veilles.
                    </p>
                    <button className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium" style={{ border: `1px solid ${t.border}`, color: t.textPrimary }}>
                      <Info size={14} /> Astuces de recherche
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Detection result (shared across all search tabs) ── */}
            {detected && !added && (
              <div className="max-w-lg space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${t.accent}15` }}>
                    <tab.icon size={22} style={{ color: t.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold" style={{ color: t.textHeading }}>{detected.name}</p>
                    <p className="text-[11px] uppercase tracking-wider mt-0.5" style={{ color: t.textSecondary }}>{detected.type}</p>
                  </div>
                  <Check size={18} style={{ color: '#22c55e' }} />
                </div>

                {/* Folder selector */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 block" style={{ color: t.textSecondary }}>Dossier (optionnel)</label>
                  {!showNewFolder ? (
                    <div className="flex items-center gap-2">
                      <select value={selectedFolder} onChange={e => setSelectedFolder(e.target.value)}
                        className="flex-1 text-[13px] px-3 py-2.5 rounded-lg outline-none"
                        style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }}>
                        <option value="">Sans dossier</option>
                        {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                      <button onClick={() => setShowNewFolder(true)} className="p-2.5 rounded-lg" style={{ color: t.textSecondary, border: `1px solid ${t.border}` }}>
                        <FolderPlus size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nom du dossier..." autoFocus
                        className="flex-1 text-[13px] px-3 py-2.5 rounded-lg outline-none"
                        style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textPrimary }} />
                      <button onClick={() => setShowNewFolder(false)} className="p-2.5 rounded-lg" style={{ color: t.textSecondary }}><X size={15} /></button>
                    </div>
                  )}
                </div>

                <button onClick={handleAdd} disabled={adding}
                  className="w-full py-3 text-[14px] font-semibold text-white rounded-xl flex items-center justify-center gap-2"
                  style={{ background: t.accent }}>
                  {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  S'abonner
                </button>
              </div>
            )}

            {/* Success */}
            {added && (
              <div className="max-w-lg">
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#0f2d1a', border: '1px solid #22c55e30' }}>
                  <Check size={18} style={{ color: '#22c55e' }} />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: '#22c55e' }}>Source ajout\ée</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#4ade80' }}>{detected?.name}</p>
                  </div>
                </div>
                <button onClick={() => { setUrl(''); setDetected(null); setAdded(false); }}
                  className="mt-3 text-[12px] font-medium" style={{ color: t.accent }}>+ Ajouter une autre source</button>
              </div>
            )}
          </div>
        )}

        {/* Error (shared) */}
        {error && (
          <div className="max-w-lg mt-4">
            <p className="text-[12px] px-3 py-2 rounded-lg" style={{ color: '#ef4444', background: '#2d1515', border: '1px solid #ef444430' }}>{error}</p>
          </div>
        )}

        {/* Success for import */}
        {activeTab === 'import' && added && (
          <div className="max-w-lg mt-4">
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#0f2d1a', border: '1px solid #22c55e30' }}>
              <Check size={18} style={{ color: '#22c55e' }} />
              <span className="text-[13px] font-semibold" style={{ color: '#22c55e' }}>Import termin\é avec succ\ès</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
