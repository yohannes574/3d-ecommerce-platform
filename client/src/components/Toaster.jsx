import { useEffect, useState } from 'react';

const STYLES = {
  success: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  error: 'border-red-400/40 bg-red-500/15 text-red-200',
  info: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100',
};
const ICONS = { success: '✅', error: '⚠️', info: 'ℹ️' };

export default function Toaster() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const t = e.detail;
      setToasts((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3400);
    };
    window.addEventListener('voltix-toast', handler);
    return () => window.removeEventListener('voltix-toast', handler);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[9999] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur-md ${
            STYLES[t.type] || STYLES.info
          }`}
        >
          <span>{ICONS[t.type] || ICONS.info}</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
