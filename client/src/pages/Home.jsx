import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../api/client';
import ProductCard from '../components/ProductCard';
import ModelViewer from '../three/LazyModelViewer';
import { CATEGORIES, optionSwatch } from '../constants';
import { useSeo } from '../utils/seo';

const STEPS = [
  ['🧊', 'Explore in 3D', 'Rotate and zoom any product model — inspect the design from every angle.'],
  ['📍', 'Tap the hotspots', 'Sellers pin markers on models explaining displays, cameras, ports and more.'],
  ['🛒', 'Buy with confidence', 'Pick color & storage, add to cart, check out — no surprises on delivery day.'],
];

export default function Home() {
  useSeo('Shop electronics in interactive 3D', 'Voltix is a multi-vendor electronics marketplace where you can explore every phone in interactive 3D before you buy.');
  const [featured, setFeatured] = useState([]);
  const [hero, setHero] = useState(null);

  useEffect(() => {
    productApi
      .list({ featured: 'true', limit: 8 })
      .then((d) => {
        setFeatured(d.products);
        setHero(d.products[0] || null);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* ---------- hero ---------- */}
      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pt-10 pb-14 lg:grid-cols-2">
        <div className="fade-up">
          <span className="badge mb-4 bg-indigo-500/20 text-indigo-200">⚡ The 3D electronics marketplace</span>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            See every phone in{' '}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-cyan-300 bg-clip-text text-transparent">interactive 3D</span>{' '}
            before you buy.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
            Spin it, zoom it, tap the glowing hotspots to explore features up close.
            Voltix connects you with approved sellers and real 3D product experiences.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products" className="btn-primary px-6 py-3 text-base">Browse products →</Link>
            <Link to="/register?role=seller" className="btn-ghost px-6 py-3 text-base">Become a seller</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-400">
            <div>✅ Approved sellers</div>
            <div>🧊 Interactive 3D</div>
            <div>📍 Feature hotspots</div>
          </div>
        </div>

        <div className="fade-up">
          {hero ? (
            <>
              <ModelViewer
                key={hero._id}
                modelUrl={hero.model3dUrl || ''}
                hotspots={[]}
                accentColor={optionSwatch(hero.variants?.find((v) => v.name.toLowerCase().includes('color'))?.values?.[0] || '')}
                className="card h-[420px]"
              />
              <Link
                to={`/products/${hero._id}`}
                className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-cyan-400/40"
              >
                <div>
                  <div className="text-xs text-slate-400">Featured today</div>
                  <div className="font-bold">{hero.brand} {hero.name}</div>
                </div>
                <span className="text-sm font-semibold text-cyan-300">View in 3D →</span>
              </Link>
            </>
          ) : (
            <div className="skeleton h-[420px]" />
          )}
        </div>
      </section>

      {/* ---------- categories ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        <h2 className="mb-4 text-xl font-bold">Shop by category</h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((c) =>
            c.live ? (
              <Link key={c.value} to={`/products?category=${c.value}`}
                className="card flex items-center gap-2 px-5 py-3 font-semibold transition hover:border-cyan-400/40 hover:text-cyan-200">
                <span className="text-xl">{c.icon}</span> {c.label}
              </Link>
            ) : (
              <span key={c.value} title="Coming soon"
                className="cursor-not-allowed rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3 font-semibold text-slate-600">
                <span className="text-xl">{c.icon}</span> {c.label} · soon
              </span>
            )
          )}
        </div>
      </section>

      {/* ---------- featured grid ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-xl font-bold">Featured in 3D ✦</h2>
          <Link to="/products" className="text-sm font-semibold text-cyan-300 hover:underline">See all →</Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.length
            ? featured.slice(0, 4).map((p) => <ProductCard key={p._id} product={p} />)
            : Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-80" />)}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="mb-8 text-center text-2xl font-bold">How 3D shopping works</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map(([icon, t, d]) => (
            <div key={t} className="card p-6 text-center">
              <div className="mb-3 text-4xl">{icon}</div>
              <h3 className="mb-2 text-lg font-bold">{t}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- seller CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="card relative overflow-hidden p-10 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/15 via-transparent to-cyan-500/15" />
          <h2 className="relative text-2xl font-extrabold">Sell on Voltix</h2>
          <p className="relative mx-auto mt-2 max-w-xl text-slate-400">
            Create listings with photos, specs, variants, GLB 3D models and interactive hotspots.
            Register as a seller — after admin approval you're ready to list.
          </p>
          <Link to="/register?role=seller" className="btn-primary relative mt-6 px-6 py-3">Start selling ⚡</Link>
        </div>
      </section>

    </div>
  );
}
