// src/v2/components/AddSourceModal.tsx
// Inoreader-style: paste URL → auto-detect → add to folder
import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Search, Loader2, Rss, Globe, Send, Twitter, Cloud, Facebook, Plus, FolderPlus, Check } from 'lucide-react';
import { detectSource, addSource, listFolders, createFolder, type DetectedSource, type FolderData } from '@/v2/lib/sources-api';

const TYPE_ICONS: Record<string, typeof Rss> = {
  rss: Rss,
  telegram: Send,
  twitter: Twitter,
  bluesky: Cloud,
  facebook: Facebook,
  web_scraper: Globe,
};

const TYPE_COLORS: Record<string, string> = {
  rss: 'text-orange-500 bg-orange-50',
  telegram: 'text-blue-500 bg-blue-50',
  twitter: 'text-sky-500 bg-sky-50',
  bluesky: 'text-indigo-500 bg-indigo-50',
  facebook: 'text-blue-600 bg-blue-50',
  web_scraper: 'text-slate-500 bg-slate-50',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddSourceModal({ open, onClose, onAdded }: Props) {
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl('');
      setDetected(null);
      setAdded(false);
      setError('');
      setSelectedFolder('');
      setTimeout(() => inputRef.current?.focus(), 100);
      listFolders().then(d => setFolders(d.folders)).catch(() => {});
    }
  }, [open]);

  const handleDetect = useCallback(async () => {
    if (!url.trim()) return;
    setDetecting(true);
    setError('');
    setDetected(null);
    try {
      const result = await detectSource(url.trim());
      setDetected(result);
    } catch (e: any) {
      setError(e.message || 'Impossible de détecter cette source');
    } finally {
      setDetecting(false);
    }
  }, [url]);

  const handleAdd = useCallback(async () => {
    if (!detected) return;
    setAdding(true);
    setError('');
    try {
      let folderId = selectedFolder;

      // Create new folder if needed
      if (showNewFolder && newFolderName.trim()) {
        const f = await createFolder({ name: newFolderName.trim() });
        folderId = f.id;
      }

      await addSource({
        type: detected.type,
        config: detected.config,
        name: detected.name,
        folder_id: folderId || undefined,
      });
      setAdded(true);
      onAdded?.();
      setTimeout(() => { onClose(); }, 1500);
    } catch (e: any) {
      const msg = e.message || 'Erreur lors de l\'ajout';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setAdding(false);
    }
  }, [detected, selectedFolder, showNewFolder, newFolderName, onAdded, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!detected) handleDetect();
      else handleAdd();
    }
  }, [detected, handleDetect, handleAdd]);

  if (!open) return null;

  const Icon = detected ? (TYPE_ICONS[detected.type] || Globe) : Search;
  const colorCls = detected ? (TYPE_COLORS[detected.type] || 'text-slate-500 bg-slate-50') : '';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed top-[12vh] left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-white rounded-2xl shadow-2xl z-[61] overflow-hidden border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Ajouter une source</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X size={16} /></button>
        </div>

        {/* URL Input */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setDetected(null); setAdded(false); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="Coller une URL (RSS, Twitter, Telegram, Facebook, site web...)"
                className="w-full pl-10 pr-4 py-3 text-[14px] text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#42d3a5] focus:ring-1 focus:ring-[#42d3a5]/20 placeholder-slate-400"
              />
            </div>
            <button
              onClick={handleDetect}
              disabled={detecting || !url.trim()}
              className="px-4 py-3 text-sm font-semibold text-white bg-[#42d3a5] rounded-xl hover:bg-[#36b891] disabled:opacity-40 transition-colors shrink-0"
            >
              {detecting ? <Loader2 size={16} className="animate-spin" /> : 'Détecter'}
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-2 px-1">
            RSS · Twitter/X · Facebook · Telegram · Bluesky · YouTube · Page web
          </p>
        </div>

        {/* Detection result */}
        {detected && !added && (
          <div className="px-5 pb-4 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorCls}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">{detected.name}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{detected.type}</p>
              </div>
              <Check size={16} className="text-emerald-500 shrink-0" />
            </div>

            {/* Folder selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Dossier (optionnel)
              </label>
              {!showNewFolder ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedFolder}
                    onChange={e => setSelectedFolder(e.target.value)}
                    className="flex-1 text-[12px] px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#42d3a5] text-slate-700"
                  >
                    <option value="">Sans dossier</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <button
                    onClick={() => setShowNewFolder(true)}
                    className="p-2 text-slate-400 hover:text-[#42d3a5] border border-slate-200 rounded-lg hover:border-[#42d3a5]/30 transition-colors"
                    title="Nouveau dossier"
                  >
                    <FolderPlus size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Nom du dossier..."
                    className="flex-1 text-[12px] px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#42d3a5] text-slate-700"
                    autoFocus
                  />
                  <button onClick={() => setShowNewFolder(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Add button */}
            <button
              onClick={handleAdd}
              disabled={adding}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#42d3a5] rounded-xl hover:bg-[#36b891] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter cette source
            </button>
          </div>
        )}

        {/* Success */}
        {added && (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <Check size={20} className="text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Source ajoutée</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">{detected?.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 pb-4">
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}
      </div>
    </>
  );
}
