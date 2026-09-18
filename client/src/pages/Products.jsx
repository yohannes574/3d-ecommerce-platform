import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productApi } from '../api/client';
import ProductCard from '../components/ProductCard';
import { CATEGORIES } from '../constants';
import { useSeo } from '../utils/seo';

const SORTS = [
  ['newest', 'Newest'],
  ['price-asc', 'Price: low → high'],
  ['price-desc', 'Price: high → low'],
  ['name', 'Name A–Z'],
];

export default function Products() {
  useSeo('Browse products', 'Search, filter and explore the Voltix electronics catalog in interactive 3D.');
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('newest');
  const [meta, setMeta] = useState({ categories: [], brands: [] });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    productApi.meta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    const query = { page };
    if (debouncedQ) query.q = debouncedQ;
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (sort) query.sort = sort;
    productApi
      .list(query)
      .then((d) => {
        setProducts(d.products);
        setPages(d.pages || 1);
        setTotal(d.total ?? d.products.length);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [debouncedQ, category, brand, sort, page]);

  // reset to first page whenever filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, category, brand, sort]);

  const liveCategories = useMemo(
    () => CATEGORIES.filter((c) => c.live),
    []
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Explore products</h1>
      <p className="mt-1 text-sm text-slate-400">
        Smartphone-first today — laptops, headphones and more are on the roadmap.
      </p>

      {/* ---------- controls ---------- */}
      <div className="card mt-6 flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
        <input
          className="input lg:max-w-xs"
          placeholder="🔎 Search name or brand…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setCategory(''); setBrand(''); }}
            className={`badge cursor-pointer px-3 py-1.5 ${!category ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            All
          </button>
          {liveCategories.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(category === c.value ? '' : c.value)}
              className={`badge cursor-pointer px-3 py-1.5 ${category === c.value ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <select className="select w-auto" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All brands</option>
            {(meta.brands || []).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select className="select w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---------- grid ---------- */}
      <p className="mt-5 mb-3 text-sm text-slate-500">
        {loading ? 'Loading…' : `${total} product${total === 1 ? '' : 's'} found`}
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-80" />)
          : products.map((p) => <ProductCard key={p._id} product={p} />)}
      </div>

      {/* ---------- pagination ---------- */}
      {!loading && pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button className="btn-ghost px-4 py-2" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span className="text-sm text-slate-400">
            Page <span className="font-bold text-slate-200">{page}</span> of {pages}
          </span>
          <button className="btn-ghost px-4 py-2" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="card mt-6 p-14 text-center">
          <div className="mb-3 text-5xl">🛰️</div>
          <h3 className="text-lg font-bold">No products match your filters</h3>
          <p className="mt-1 text-sm text-slate-400">Try clearing the search or picking another category.</p>
          <button
            className="btn-ghost mt-5"
            onClick={() => { setQ(''); setCategory(''); setBrand(''); }}
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
