export const CATEGORIES = [
  { value: 'smartphone', label: 'Smartphones', icon: '📱', live: true },
  { value: 'laptop', label: 'Laptops', icon: '💻', live: false },
  { value: 'tablet', label: 'Tablets', icon: '📲', live: false },
  { value: 'headphone', label: 'Headphones', icon: '🎧', live: false },
  { value: 'smartwatch', label: 'Smartwatches', icon: '⌚', live: false },
  { value: 'accessory', label: 'Accessories', icon: '🔌', live: false },
];

const COLOR_MAP = {
  black: '#16171c',
  graphite: '#2c2e33',
  silver: '#d8dade',
  platinum: '#d8dade',
  blue: '#1e3f8f',
  cyan: '#06b6d4',
  sky: '#7fb2e5',
  green: '#15803d',
  mint: '#79c7ac',
  lavender: '#a08fd8',
  purple: '#8b5cf6',
  pink: '#e8a2b7',
  rose: '#ec4899',
  gold: '#d8b26e',
  red: '#c03434',
  orange: '#e07a3f',
  white: '#eceae4',
  titanium: '#6d7076',
};

/** Normalize anything (#rgb, #rrggbb, named CSS colors, hsl()) to a #rrggbb hex string. */
export function toHex(color = '') {
  const d = document.createElement('div');
  d.style.color = '';
  d.style.color = String(color);
  if (!d.style.color) return '#8b9bb4';
  document.body.appendChild(d);
  const c = getComputedStyle(d).color; // always rgb(...) when valid
  document.body.removeChild(d);
  const m = c.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  if (!m) return '#8b9bb4';
  const hex = `#${m.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  return hex;
}

/**
 * Hex for a variant option — prefers the seller-specified swatch, falls back
 * to guessing from the name. Accepts an option object or a plain string.
 */
export function optionSwatch(opt, fallbackName = '') {
  if (opt && typeof opt === 'object' && opt.swatch) return toHex(opt.swatch);
  return colorForName(typeof opt === 'object' ? fallbackName || opt?.value : opt);
}

/** Best-effort hex for a variant color name (used to tint the 3D model). */
export function colorForName(name = '') {
  const k = String(name).toLowerCase().trim();
  for (const key of Object.keys(COLOR_MAP)) {
    if (k.includes(key)) return COLOR_MAP[key];
  }
  let h = 0;
  for (let i = 0; i < k.length; i++) h = k.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  /* HSL → hex without external deps (three.js <input type=color> want hex) */
  const s = 0.42, l = 0.42;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] =
    hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

/* shipping rules shared by cart + checkout + server defaults */
export const FREE_SHIPPING_OVER = 99;
export const SHIPPING_FEE = 12;

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
