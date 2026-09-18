import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productApi } from '../api/client';
import ModelViewer from '../three/LazyModelViewer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { StockBadge } from '../components/ProductCard';
import ReviewSection from '../components/ReviewSection';
import { RatingSummary } from '../components/Rating';
import { optionSwatch, fmtMoney } from '../constants';
import { toast } from '../utils/toast';
import { useSeo } from '../utils/seo';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('3d');
  const [openHs, setOpenHs] = useState(null);
  const [qty, setQty] = useState(1);

  // selections[variantName] = chosen value
  const [selections, setSelections] = useState({});

  useSeo(
    product ? `${product.brand} ${product.name}` : 'Product',
    product ? `Buy the ${product.brand} ${product.name} — explore it in interactive 3D on Voltix.` : undefined
  );

  useEffect(() => {
    setProduct(null);
    setError('');
    setOpenHs(null);
    setTab('3d');
    productApi
      .get(id)
      .then((d) => {
        setProduct(d.product);
        // preselect first value of each variant group (API normalizes to {value, priceDelta})
        const init = {};
        d.product.variants?.forEach((v) => {
          const first = v.values?.[0];
          if (first) init[v.name] = typeof first === 'string' ? first : first.value;
        });
        setSelections(init);
      })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load product.'));
  }, [id]);

  const accent = useMemo(() => {
    const colorGroup = product?.variants?.find((v) => v.name.toLowerCase().includes('color'));
    if (!colorGroup) return '#2563eb';
    const opt = (colorGroup.values || []).find(
      (o) => (typeof o === 'string' ? o : o?.value) === selections[colorGroup.name]
    );
    return optionSwatch(opt);
  }, [product, selections]);

  /* effective price = base + selected options' price deltas (server computes the same way) */
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    let total = product.price;
    for (const g of product.variants || []) {
      const opt = g.values?.find((o) => o.value === selections[g.name]);
      if (opt) total += opt.priceDelta || 0;
    }
    return Math.max(0, total);
  }, [product, selections]);

  const hasPricedOptions = useMemo(
    () => (product?.variants || []).some((g) => (g.values || []).some((o) => (o.priceDelta || 0) > 0)),
    [product]
  );

  /* Is the current selection available? An option with its own stock field can
     be sold out independently (e.g. 256GB gone, 512GB left). */
  const selectionAvailable = useMemo(() => {
    if (!product) return false;
    if ((product.stock || 0) < 1) return false;
    for (const g of product.variants || []) {
      const opt = (g.values || []).find((o) => o.value === selections[g.name]);
      if (opt && typeof opt.stock === 'number' && opt.stock < 1) return false;
    }
    return true;
  }, [product, selections]);

  /* smallest per-option stock among tracked options in the current selection */
  const selectionStock = useMemo(() => {
    if (!product) return 0;
    let min = product.stock || 0;
    for (const g of product.variants || []) {
      const opt = (g.values || []).find((o) => o.value === selections[g.name]);
      if (opt && typeof opt.stock === 'number') min = Math.min(min, opt.stock);
    }
    return min;
  }, [product, selections]);

  const handleAdd = async () => {
    if (!user) {
      toast('Please log in as a customer to add items.', 'info');
      return navigate('/login', { state: { from: `/products/${id}` } });
    }
    if (user.role !== 'customer') {
      return toast('Shopping is available on customer accounts.', 'error');
    }
    const variant = Object.entries(selections).map(([name, value]) => ({ name, value }));
    try {
      await addToCart(product._id, qty, variant);
    } catch (e) {
      toast(e.response?.data?.message || 'Could not add to cart.', 'error');
    }
  };

  if (error) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center">
        <div className="card p-10">
          <div className="mb-3 text-5xl">🛸</div>
          <h1 className="mb-2 text-xl font-bold">{error}</h1>
          <Link className="btn-primary mt-4" to="/products">← Back to products</Link>
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-2">
        <div className="skeleton h-[540px]" />
        <div className="space-y-4">
          <div className="skeleton h-10 w-3/4" />
          <div className="skeleton h-6 w-40" />
          <div className="skeleton h-32" />
          <div className="skeleton h-12 w-56" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link to="/products" className="hover:text-cyan-300">Products</Link>
        <span className="mx-2">/</span>
        <span className="capitalize">{product.category}</span>
        <span className="mx-2">/</span>
        <span className="text-slate-300">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* ---------- left: 3D / photos ---------- */}
        <div>
          <div className="mb-3 flex gap-2">
            <button onClick={() => setTab('3d')}
              className={`btn ${tab === '3d' ? 'btn-primary' : 'btn-ghost'}`}>🧊 3D View</button>
            <button onClick={() => setTab('photos')} disabled={!product.images.length}
              className={`btn ${tab === 'photos' ? 'btn-primary' : 'btn-ghost'}`}>
              🖼️ Photos ({product.images.length})
            </button>
          </div>

          {tab === '3d' ? (
            <>
              <ModelViewer
                modelUrl={product.model3dUrl || ''}
                hotspots={product.hotspots}
                accentColor={accent}
                openIndex={openHs}
                onToggleHotspot={setOpenHs}
                className="card h-[480px] sm:h-[540px]"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>🖱️ Drag to rotate · Scroll to zoom</span>
                {product.hotspots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {product.hotspots.map((h, i) => (
                      <button key={i} onClick={() => setOpenHs(openHs === i ? null : i)}
                        className={`badge cursor-pointer ${openHs === i ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/5 hover:bg-white/10'}`}>
                        {i + 1}. {h.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {product.images.map((src, i) => (
                <img key={i} src={src} alt={`${product.name} ${i + 1}`}
                  className="w-full rounded-xl border border-white/10 object-cover" />
              ))}
            </div>
          )}
        </div>

        {/* ---------- right: buy box ---------- */}
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="font-bold text-slate-200">{product.brand}</span>
            <span>·</span>
            <Link to={`/products?brand=${encodeURIComponent(product.brand)}`} className="hover:text-cyan-300">More from this brand</Link>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{product.name}</h1>
          {hasPricedOptions && (
            <p className="mt-1 text-xs text-slate-500">Price changes with your {product.variants.filter((g) => (g.values || []).some((o) => (o.priceDelta || 0) > 0)).map((g) => g.name).join(' & ')} choice</p>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-cyan-300">{fmtMoney(unitPrice)}</span>
            {product.compareAtPrice > product.price && (
              <>
                <span className="text-lg text-slate-500 line-through">{fmtMoney(product.compareAtPrice)}</span>
                <span className="badge bg-pink-500/20 text-pink-300">Save {fmtMoney(product.compareAtPrice - product.price)}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a href="#reviews" className="transition hover:opacity-80">
              <RatingSummary rating={product.averageRating} count={product.numReviews} />
            </a>
            <StockBadge stock={selectionStock} />
          </div>

          <p className="mt-5 leading-relaxed text-slate-400">{product.description}</p>

          {/* variants */}
          {product.variants?.map((v) => (
            <div key={v.name} className="mt-6">
              <div className="label">{v.name}: <span className="normal-case text-slate-200">{selections[v.name]}</span></div>
              <div className="flex flex-wrap gap-2">
                {v.values.map((opt) => {
                  const val = typeof opt === 'string' ? opt : opt.value;
                  const delta = typeof opt === 'string' ? 0 : opt.priceDelta || 0;
                  const optStock = typeof opt === 'object' && opt ? opt.stock : undefined;
                  const soldOut = typeof optStock === 'number' && optStock < 1;
                  const isColor = v.name.toLowerCase().includes('color');
                  const active = selections[v.name] === val;
                  return (
                    <button key={val} disabled={soldOut}
                      onClick={() => setSelections((s) => ({ ...s, [v.name]: val }))}
                      title={soldOut ? 'This option is out of stock' : undefined}
                      className={`btn border px-4 py-2 text-sm ${
                        soldOut ? 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600 line-through'
                        : active ? 'border-cyan-400 bg-cyan-500/15 text-cyan-100'
                                 : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                      {isColor && !soldOut && (
                        <span className="mr-2 inline-block h-4 w-4 rounded-full border border-white/20 align-middle"
                          style={{ background: optionSwatch(opt) }} />
                      )}
                      {val}
                      {delta !== 0 && !soldOut && (
                        <span className={`ml-2 text-xs font-bold ${delta > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {delta > 0 ? '+' : '−'}{fmtMoney(Math.abs(delta))}
                        </span>
                      )}
                      {soldOut && <span className="ml-2 text-[10px] font-bold uppercase">sold out</span>}
                    </button>
                  );
                })}
              </div>
              {isColorGroup(v.name) && (
                <p className="mt-2 text-xs text-indigo-300">✨ The 3D model updates with your color choice</p>
              )}
            </div>
          ))}
          {/* qty + actions */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl border border-white/10 bg-white/5">
              <button className="cursor-pointer px-4 py-2.5 text-lg hover:text-cyan-300" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
              <span className="w-10 text-center font-bold">{qty}</span>
              <button className="cursor-pointer px-4 py-2.5 text-lg hover:text-cyan-300" onClick={() => setQty(Math.min(product.stock || 1, qty + 1))}>+</button>
            </div>
            <button className="btn-primary flex-1 py-3 text-base" disabled={!selectionAvailable} onClick={handleAdd}>
              {selectionAvailable ? `🛒 Add to cart · ${fmtMoney(unitPrice * qty)}` : 'Selected option is sold out'}
            </button>
          </div>

          {product.seller && (
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
              Sold by <span className="font-bold text-slate-200">{product.seller.shopName || product.seller.name}</span>{' '}
              <span className="badge ml-1 bg-emerald-500/15 align-middle text-emerald-300">✔ approved seller</span>
            </div>
          )}
        </div>
      </div>

      {/* ---------- specs ---------- */}
      {product.specs?.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-bold">Specifications</h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <tbody>
                {product.specs.map((s, i) => (
                  <tr key={i} className={i % 2 ? 'bg-white/[0.02]' : ''}>
                    <td className="w-56 px-5 py-3 font-semibold text-slate-300">{s.key}</td>
                    <td className="px-5 py-3 text-slate-400">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---------- reviews ---------- */}
      <div id="reviews">
        <ReviewSection productId={product._id} product={product} />
      </div>
    </div>
  );
}


function isColorGroup(name = '') {
  return name.toLowerCase().includes('color');
}
