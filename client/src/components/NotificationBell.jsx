import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../constants';

const TYPE_ICON = { order: '🚚', product: '📦', seller: '🏪', review: '⭐', account: '👤' };

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);

  const load = useCallback(() => {
    if (!user) return;
    notificationApi
      .list()
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unread);
      })
      .catch(() => {});
  }, [user]);

  useEffect(load, [load]);

  /* poll every 30s while logged in */
  useEffect(() => {
    if (!user) return undefined;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user, load]);

  /* close on outside click */
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) return null;

  const openItem = async (n) => {
    notificationApi.markRead(n._id).catch(() => {});
    setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - (n.read ? 0 : 1)));
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await notificationApi.markAllRead().catch(() => {});
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative rounded-lg px-2 py-2 text-lg transition hover:bg-white/5"
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="cursor-pointer text-xs text-cyan-300 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Nothing yet — you're all caught up 🎉</div>
            ) : (
              items.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openItem(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                    n.read ? '' : 'bg-cyan-500/[0.06]'
                  }`}
                >
                  <span className="text-lg leading-none">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${n.read ? 'text-slate-300' : 'font-bold text-white'}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[10px] text-slate-600">{fmtDate(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
