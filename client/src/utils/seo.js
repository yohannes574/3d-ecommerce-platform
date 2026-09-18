import { useEffect } from 'react';

function apply(title, description) {
  document.title = title ? `${title} — Voltix` : 'Voltix — 3D Electronics Marketplace';
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
  }
}

/** Hook: useSeo('Product', 'description…') — sets title/meta, resets on unmount. */
export function useSeo(title, description) {
  useEffect(() => {
    const prev = document.title;
    apply(title, description);
    return () => {
      document.title = prev;
    };
  }, [title, description]);
}
