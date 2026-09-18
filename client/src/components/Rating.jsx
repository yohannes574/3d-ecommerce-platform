/**
 * Small rating presentation helpers shared across the storefront.
 * All components are display-only; writing reviews lives in ReviewSection.
 */

export function Stars({ value = 0, size = 'text-sm', className = '' }) {
  const rounded = Math.round(value * 2) / 2; // nearest half
  const glyphs = [];
  for (let i = 1; i <= 5; i++) {
    if (rounded >= i) glyphs.push('★');
    else glyphs.push('☆');
  }
  return (
    <span className={`${size} tracking-[0.15em] text-amber-300 ${className}`} aria-label={`Rated ${value} out of 5`}>
      {glyphs.join('')}
    </span>
  );
}

/** "★★★★☆ 4.5 (12)" — collapses to "No reviews yet" when numReviews is 0 */
export function RatingSummary({ rating = 0, count = 0, size = 'text-sm' }) {
  if (!count) {
    return <span className={`${size} text-slate-500`}>No reviews yet</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${size}`}>
      <Stars value={rating} />
      <span className="font-bold text-slate-200">{Number(rating).toFixed(1)}</span>
      <span className="text-slate-500">({count})</span>
    </span>
  );
}
