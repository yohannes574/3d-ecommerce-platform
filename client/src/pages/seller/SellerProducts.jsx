import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sellerApi, orderApi, uploadLicense, authApi, errMsg } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { fmtDate, fmtMoney } from '../../constants';
import { Stars } from '../../components/Rating';
import { toast } from '../../utils/toast';

const STATUS_BADGE = {
  approved: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-300',
  draft: 'bg-slate-500/20 text-slate-300',
  rejected: 'bg-red-500/15 text-red-300',
};

const ORDER_STATUS_BADGE = {
  placed: 'bg-indigo-500/15 text-indigo-300',
  confirmed: 'bg-cyan-500/15 text-cyan-300',
  shipped: 'bg-amber-500/15 text-amber-300',
  delivered: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-300',
};

/** Shown to pending/rejected sellers: status, license state, and re-upload form. */
function PendingGate({ user }) {
  const { refreshUser } = useAuth();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const rejected = user.status === 'rejected';

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadLicense(file);
      const d = await authApi.submitLicense({ licenseUrl: up.url, licenseOriginalName: file.name });
      toast(d.message || 'License submitted');
      refreshUser?.();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pt-16 text-center">
      <div className="card fade-up p-10">
        <div className="mb-4 text-6xl">{rejected ? '❌' : '⏳'}</div>
        <h1 className="text-xl font-extrabold">
          {rejected ? 'Your application was not approved' : 'Your store is awaiting approval'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          {rejected
            ? 'An admin reviewed your store and did not approve it. You can submit an updated business license below to re-apply.'
            : 'An admin needs to verify your business license before you can create listings and sell on Voltix.'}
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
          {user.licenseUrl ? (
            <>
              License on file:{' '}
              <a href={user.licenseUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 hover:underline">
                📄 {user.licenseOriginalName || 'view document'}
              </a>
            </>
          ) : (
            <span className="text-red-300">No license on file — upload your business license to (re)apply.</span>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".pdf,image/*" hidden onChange={pick} />
        <button className="btn-primary mt-5" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Uploading…' : user.licenseUrl ? 'Replace license & re-apply' : 'Upload business license'}
        </button>
        <p className="mt-3 text-[11px] text-slate-500">PDF or image, max 10 MB. Re-submitting returns your store to the review queue.</p>
      </div>
    </div>
  );
}

export default function SellerProducts() {
  const { user } = useAuth();
  const [tab, setTab] = useState('products');
  const [products, setProducts] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState(null);

  const isPendingSeller = user?.role === 'seller' && user?.status !== 'approved';

  const load = useCallback(() => {
    if (isPendingSeller) return;
    sellerApi.mine().then((d) => setProducts(d.products)).catch((e) => toast(errMsg(e), 'error'));
    sellerApi.stats().then((d) => setStats(d.stats)).catch(() => {});
    sellerApi.orders().then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  }, [isPendingSeller]);

  useEffect(load, [load]);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await sellerApi.remove(p._id);
      toast('Product deleted', 'info');
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  /* ---------- seller order confirmation ---------- */
  const confirmOrder = async (o) => {
    try {
      const d = await orderApi.confirm(o._id);
      toast(d.message || 'Order confirmed');
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const rejectPayment = async (o) => {
    if (!window.confirm('Reject this payment? The order will be cancelled and stock restored.')) return;
    try {
      const d = await orderApi.rejectPayment(o._id);
      toast(d.message || 'Payment rejected', 'info');
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  /* ---------- awaiting-approval gate with license (re)submission ---------- */
  if (isPendingSeller) {
    return <PendingGate user={user} />;
  }

  const s = stats || {
    products: products?.length ?? 0,
    approved: (products || []).filter((p) => p.status === 'approved').length,
    pending: (products || []).filter((p) => p.status === 'pending').length,
    drafts: (products || []).filter((p) => p.status === 'draft').length,
    revenue: 0,
    unitsSold: 0,
    orders: 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">🏪 Seller Hub</h1>
          <p className="mt-1 text-sm text-slate-400">
            Welcome{user?.shopName ? `, ${user.shopName}` : ''} — manage your catalog, orders and 3D experiences.
          </p>
        </div>
        <Link to="/seller/products/new" className="btn-primary ml-auto">＋ New product</Link>
      </div>

      {/* stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Revenue', fmtMoney(s.revenue), 'text-cyan-300'],
          ['Units sold', s.unitsSold, 'text-emerald-300'],
          ['Orders', s.orders, 'text-indigo-300'],
          ['Approved', s.approved, 'text-emerald-300'],
          ['Pending', s.pending, 'text-amber-300'],
          ['Drafts', s.drafts, 'text-slate-300'],
        ].map(([label, val, cls]) => (
          <div key={label} className="card px-4 py-4">
            <div className={`truncate text-xl font-extrabold ${cls}`}>{val}</div>
            <div className="text-xs tracking-wide text-slate-400 uppercase">{label}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="mb-5 flex w-fit rounded-xl border border-white/10 bg-white/5 p-1">
        {[['products', '📦 Products'], ['orders', '🚚 Orders']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white' : 'text-slate-300 hover:bg-white/10'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          {!products ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : products.length === 0 ? (
            <div className="card p-14 text-center">
              <div className="mb-3 text-5xl">🧊</div>
              <h2 className="text-lg font-bold">No products yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
                Create your first listing — add specs, variants, a GLB 3D model and interactive hotspots.
              </p>
              <Link to="/seller/products/new" className="btn-primary mt-6">Create product</Link>
            </div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs tracking-wider text-slate-400 uppercase">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Rating</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Updated</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="h-11 w-11 rounded-lg border border-white/10 object-cover" />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/5">📱</div>
                          )}
                          <div>
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-xs text-slate-500 capitalize">{p.brand} · {p.category}{p.model3dUrl ? ' · 🧊 GLB' : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold">{fmtMoney(p.price)}</td>
                      <td className="px-3 py-3">
                        {p.numReviews > 0 ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                            <Stars value={p.averageRating} size="text-[11px]" />
                            <span className="font-bold text-slate-300">{Number(p.averageRating).toFixed(1)}</span>
                            <span className="text-slate-500">({p.numReviews})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">{p.stock}</td>
                      <td className="px-3 py-3"><span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-500">{fmtDate(p.updatedAt)}</td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <Link to={`/seller/products/${p._id}/edit`} className="btn-ghost mr-2 px-3 py-1.5 text-xs">Edit</Link>
                        <button onClick={() => remove(p)} className="btn-danger px-3 py-1.5 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            ℹ️ New and edited products go to the admin approval queue before appearing in the storefront.
          </p>
        </>
      )}

      {tab === 'orders' && (
        <>
          {!orders ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
          ) : orders.length === 0 ? (
            <div className="card p-14 text-center text-slate-400">
              <div className="mb-3 text-5xl">📭</div>
              No orders containing your products yet.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o._id} className={`card p-5 ${o.status === 'placed' ? 'border-amber-400/30' : ''}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-slate-400">#{o._id.slice(-8).toUpperCase()}</span>
                    <span className="text-slate-500">{fmtDate(o.createdAt)}</span>
                    <span className="text-slate-400">for <span className="font-semibold text-slate-200">{o.user?.name || 'customer'}</span></span>
                    <span className={`badge ml-auto ${ORDER_STATUS_BADGE[o.status] || 'bg-white/10'}`}>{o.status}</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {o.items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-slate-300">{it.name} × {it.qty}</span>
                        {it.variant?.length > 0 && (
                          <span className="hidden text-xs text-slate-500 sm:block">{it.variant.map((v) => v.value).join(', ')}</span>
                        )}
                        <span className="font-semibold">{fmtMoney(it.unitPrice * it.qty)}</span>
                      </div>
                    ))}
                  </div>

                  {/* payment + confirm/reject actions (seller is the confirmer) */}
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-sm">
                    {{ cod: <span className="text-slate-400">💵 Cash on delivery</span>,
                      chapa: <span className="text-emerald-300">🟢 Chapa</span>,
                      telebirr: <span className="text-cyan-300">📱 Telebirr</span>,
                      bank_transfer: <span className="text-indigo-300">🏦 Bank transfer</span> }[o.paymentMethod] || <span>{o.paymentMethod}</span>}
                    {o.paymentMethod === 'chapa' ? (
                      <span className="text-xs text-emerald-300">✓ payment is verified electronically by Chapa</span>
                    ) : o.paymentMethod !== 'cod' && (
                      o.paymentProof?.screenshotUrl ? (
                        <a href={o.paymentProof.screenshotUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 text-cyan-300 hover:underline" title="View full receipt">
                          <img src={o.paymentProof.screenshotUrl} alt="payment receipt" className="h-9 w-9 rounded border border-white/20 object-cover" />
                          <span className="text-xs">view receipt · ref <b className="font-mono">{o.paymentProof.transactionRef}</b></span>
                        </a>
                      ) : (
                        <span className="text-xs text-amber-300">⏳ waiting for customer's payment receipt…</span>
                      )
                    )}
                    <span className="ml-auto font-extrabold text-cyan-300">{fmtMoney(o.total)}</span>
                  </div>

                  {o.status === 'placed' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => confirmOrder(o)} className="btn-primary px-4 py-2 text-xs">✅ Confirm order</button>
                      {o.paymentMethod !== 'cod' && o.paymentProof?.screenshotUrl && (
                        <button onClick={() => rejectPayment(o)} className="btn-danger px-4 py-2 text-xs">✖ Reject payment</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
