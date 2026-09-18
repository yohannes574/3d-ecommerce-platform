import { Link } from 'react-router-dom';
import { fmtMoney } from '../constants';
import { RatingSummary } from './Rating';

export function StockBadge({ stock }) {
  if (stock <= 0) return <span className="badge bg-red-500/15 text-red-300">Out of stock</span>;
  if (stock <= 10) return <span className="badge bg-amber-500/15 text-amber-300">Only {stock} left</span>;
  return <span className="badge bg-emerald-500/15 text-emerald-300">In stock</span>;
}

export default function ProductCard({ product }) {
  const img = product.images?.[0];
  return (
    <Link
      to={`/products/${product._id}`}
      className="card fade-up group block overflow-hidden p-0 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-indigo-500/20"
    >
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-slate-900">
        {img ? (
          <img src={img} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="text-6xl opacity-70 transition group-hover:scale-110">📱</div>
        )}
        <span className="absolute top-3 left-3 badge bg-indigo-500/25 text-indigo-200 backdrop-blur">
          ✦ Interactive 3D
        </span>
        {product.compareAtPrice > product.price && (
          <span className="absolute top-3 right-3 badge bg-pink-500/25 text-pink-200 backdrop-blur">
            −{Math.round((1 - product.price / product.compareAtPrice) * 100)}%
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">{product.brand}</span>
          <span>·</span>
          <span className="capitalize">{product.category}</span>
        </div>
        <h3 className="mb-1 truncate text-base font-bold text-white group-hover:text-cyan-200">
          {product.name}
        </h3>
        <div className="mb-2">
          <RatingSummary rating={product.averageRating} count={product.numReviews} size="text-xs" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            {(() => {
              const hasPriced = (product.variants || []).some((g) =>
                (g.values || []).some((o) => typeof o !== 'string' && (o.priceDelta || 0) > 0)
              );
              return (
                <span className="text-lg font-extrabold text-cyan-300">
                  {hasPriced && <span className="mr-1 text-xs font-semibold text-slate-400">from</span>}
                  {fmtMoney(product.price)}
                </span>
              );
            })()}
            {product.compareAtPrice > product.price && (
              <span className="text-xs text-slate-500 line-through">{fmtMoney(product.compareAtPrice)}</span>
            )}
          </div>
          <StockBadge stock={product.stock} />
        </div>
      </div>
    </Link>
  );
}
