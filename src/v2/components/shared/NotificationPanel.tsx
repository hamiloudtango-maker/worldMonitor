/**
 * NotificationPanel — dropdown from the bell icon.
 * Shows critical/high alerts from global articles + case-specific alerts.
 * Persists read state in localStorage.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, AlertTriangle, FolderOpen, ExternalLink } from 'lucide-react';
import type { Article } from '@/v2/lib/constants';
import { timeAgo } from '@/v2/lib/constants';
import type { CaseData } from '@/v2/lib/api';

interface Props {
  articles: Article[];
  cases: CaseData[];
}

const READ_KEY = 'wm-notif-read';
const MAX_NOTIFS = 50;

function getReadIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveReadIds(ids: Set<string>) {
  // Keep only last 200 to avoid bloat
  const arr = Array.from(ids).slice(-200);
  localStorage.setItem(READ_KEY, JSON.stringify(arr));
}

interface Notification {
  id: string;
  title: string;
  link: string;
  threat: string;
  theme: string;
  pub_date: string | null;
  source: string; // 'global' | case name
  sourceType: 'global' | 'case';
}

function buildNotifications(articles: Article[], cases: CaseData[]): Notification[] {
  const alerts = articles.filter(a => a.threat_level === 'critical' || a.threat_level === 'high');

  // Build case keyword lookup for matching
  const caseMatchers = cases.map(c => ({
    name: c.name,
    keywords: (c.search_keywords || c.name).split('|').map(k => k.trim().toLowerCase()).filter(k => k.length >= 3),
  }));

  return alerts.slice(0, MAX_NOTIFS).map(a => {
    // Check if article matches a case
    const titleLow = a.title.toLowerCase();
    const matchedCase = caseMatchers.find(c =>
      c.keywords.some(kw => titleLow.includes(kw))
    );

    return {
      id: a.id,
      title: a.title,
      link: a.link,
      threat: a.threat_level,
      theme: a.theme,
      pub_date: a.pub_date,
      source: matchedCase ? matchedCase.name : 'Alerte globale',
      sourceType: matchedCase ? 'case' as const : 'global' as const,
    };
  });
}

export default function NotificationPanel({ articles, cases }: Props) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds());
  const ref = useRef<HTMLDivElement>(null);

  const notifs = buildNotifications(articles, cases);
  const unreadCount = notifs.filter(n => !readIds.has(n.id)).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      for (const n of notifs) next.add(n.id);
      saveReadIds(next);
      return next;
    });
  }, [notifs]);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white px-0.5">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 w-96 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <h3 className="text-[13px] font-bold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-[#42d3a5] hover:underline font-medium">
                  Tout marquer lu
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifs.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">Aucune alerte</div>
            )}
            {notifs.map(n => {
              const isRead = readIds.has(n.id);
              return (
                <a
                  key={n.id}
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => markRead(n.id)}
                  className={`block px-4 py-2.5 hover:bg-slate-50 transition-colors ${isRead ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div className={`mt-0.5 shrink-0 w-6 h-6 rounded-lg flex items-center justify-center ${
                      n.threat === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {n.sourceType === 'case' ? <FolderOpen size={12} /> : <AlertTriangle size={12} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                          n.threat === 'critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {n.threat}
                        </span>
                        <span className="text-[9px] font-semibold text-[#42d3a5] capitalize">{n.theme}</span>
                        <span className="text-[9px] text-slate-400 ml-auto">{n.pub_date ? timeAgo(n.pub_date) : ''}</span>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight">{n.title}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          n.sourceType === 'case' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {n.sourceType === 'case' ? `Case: ${n.source}` : n.source}
                        </span>
                        {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 ml-auto" />}
                      </div>
                    </div>

                    <ExternalLink size={10} className="text-slate-300 mt-1 shrink-0" />
                  </div>
                </a>
              );
            })}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 text-center">
              <span className="text-[10px] text-slate-400">
                {notifs.length} alertes ({unreadCount} non lues)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
