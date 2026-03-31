// src/v2/components/NotificationBell.tsx
// Real-time notification bell with SSE connection and dropdown
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, X, AlertTriangle, Info, Zap, Folder, Rss, Settings } from 'lucide-react';
import { api, API_BASE } from '@/v2/lib/api';

interface NotifItem {
  id: string;
  type: string;
  title: string;
  body?: string;
  article_id?: string;
  case_id?: string;
  read: boolean;
  starred: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  alert: AlertTriangle,
  rule: Zap,
  case: Folder,
  feed: Rss,
  system: Settings,
  digest: Info,
};

const TYPE_COLORS: Record<string, string> = {
  alert: 'text-red-500',
  rule: 'text-amber-500',
  case: 'text-blue-500',
  feed: 'text-teal-500',
  system: 'text-slate-400',
  digest: 'text-purple-500',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

interface Props {
  onOpenArticle?: (articleId: string) => void;
}

export default function NotificationBell({ onOpenArticle }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications
  useEffect(() => {
    api('/notifications/v1/?limit=30')
      .then((data: any) => setNotifications(data.notifications || []))
      .catch(() => {});
    api('/notifications/v1/count')
      .then((data: any) => setUnread(data.unread || 0))
      .catch(() => {});
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${API_BASE}/notifications/v1/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const notif = JSON.parse(event.data);
        setNotifications(prev => [{ ...notif, read: false, starred: false }, ...prev].slice(0, 50));
        setUnread(prev => prev + 1);
      } catch {}
    };

    eventSource.onerror = () => {
      // Will auto-reconnect
    };

    return () => eventSource.close();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback(async (id: string) => {
    await api(`/notifications/v1/${id}/read`, { method: 'PATCH' }).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await api('/notifications/v1/mark-all-read', { method: 'POST' }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  }, []);

  const handleClick = useCallback((notif: NotifItem) => {
    if (!notif.read) markRead(notif.id);
    if (notif.article_id && onOpenArticle) {
      onOpenArticle(notif.article_id);
      setOpen(false);
    }
  }, [markRead, onOpenArticle]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
        title="Notifications"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <CheckCheck size={12} /> Tout lire
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                Aucune notification
              </div>
            )}
            {notifications.map(notif => {
              const Icon = TYPE_ICONS[notif.type] || Bell;
              const color = TYPE_COLORS[notif.type] || 'text-slate-400';
              return (
                <button
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 ${!notif.read ? 'bg-blue-50/40' : ''}`}
                >
                  <div className={`mt-0.5 shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug ${!notif.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                      {notif.title}
                    </p>
                    {notif.body && (
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                    )}
                    <p className="text-[9px] text-slate-400 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
