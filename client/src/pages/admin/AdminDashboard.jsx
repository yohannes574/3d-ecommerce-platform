import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, errMsg } from '../../api/client';
import { fmtDate, fmtMoney } from '../../constants';
import { toast } from '../../utils/toast';

const SELLER_STATUS = {
  approved: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-300',
  rejected: 'bg-red-500/15 text-red-300',
};
const PRODUCT_STATUS = {
  approved: 'bg-emerald-500/15 text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-300',
  draft: 'bg-slate-500/20 text-slate-300',
  rejected: 'bg-red-500/15 text-red-300',
};
const ORDER_STATUS = {
  placed: 'bg-indigo-500/15 text-indigo-300',
  confirmed: 'bg-cyan-500/15 text-cyan-300',
  shipped: 'bg-amber-500/15 text-amber-300',
  delivered: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-300',
};

function Chips({ value, onChange, options }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`badge cursor-pointer px-3 py-1.5 ${value === v ? 'bg-cyan-500/25 text-cyan-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

const TABS = [
  ['sellers', '👤 Sellers'],
  ['products', '📦 Products'],
  ['orders', '🚚 Orders'],
];

export default function AdminDashboard() {
  const [tab, setTab] = useState('sellers');
  const [sellerStatus, setSellerStatus] = useState('pending');
  const [productStatus, setProductStatus] = useState('pending');
  const [orderStatus, setOrderStatus] = useState('');
  const [sellers, setSellers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);

  const loadSellers = useCallback(() => {
    adminApi.sellers(sellerStatus ? { status: sellerStatus } : {})
      .then((d) => setSellers(d.sellers))
      .catch((e) => toast(errMsg(e), 'error'));
  }, [sellerStatus]);

  const loadProducts = useCallback(() => {
    adminApi.products(productStatus ? { status: productStatus } : {})
      .then((d) => setProducts(d.products))
      .catch((e) => toast(errMsg(e), 'error'));
  }, [productStatus]);

  const loadOrders = useCallback(() => {
    adminApi.orders(orderStatus ? { status: orderStatus } : {})
      .then((d) => setOrders(d.orders))
      .catch((e) => toast(errMsg(e), 'error'));
  }, [orderStatus]);

  const loadStats = useCallback(() => {
    adminApi.stats().then((d) => setStats(d.stats)).catch(() => {});
  }, []);

  useEffect(loadStats, [loadStats]);
  useEffect(() => { if (tab === 'sellers') loadSellers(); }, [tab, loadSellers]);
  useEffect(() => { if (tab === 'products') loadProducts(); }, [tab, loadProducts]);
  useEffect(() => { if (tab === 'orders') loadOrders(); }, [tab, loadOrders]);

  const setSellerState = async (id, status) => {
    try {
      await adminApi.setSellerStatus(id, status);
      toast(`Seller ${status}.`);
      loadSellers();
      loadStats();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const setProductState = async (id, status) => {
    try {
      await adminApi.setProductStatus(id, status);
      toast(`Product ${status}.`);
      loadProducts();
      loadStats();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const toggleFeatured = async (p) => {
    try {
      await adminApi.setFeatured(p._id, !p.featured);
      loadProducts();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const setOrderState = async (id, status) => {
    try {
      await adminApi.setOrderStatus(id, status); // PATCH /orders/:id/status via adminApi wrapper
      toast(`Order marked ${status}.`);
      loadOrders();
      loadStats();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">🛡️ Admin console</h1>
          <p className="mt-1 text-sm text-slate-400">Approve sellers, review submissions, track orders and curate the storefront.</p>
        </div>
        <div className="ml-auto flex rounded-xl border border-white/10 bg-white/5 p-1">
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white' : 'text-slate-300 hover:bg-white/10'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- platform stats ---------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Revenue', fmtMoney(stats?.revenue ?? 0), 'text-cyan-300'],
          ['Orders', stats?.orders ?? '—', 'text-indigo-300'],
          ['Customers', stats?.customers ?? '—', 'text-emerald-300'],
          ['Sellers', stats?.sellers ?? '—', 'text-emerald-300'],
          ['Pending sellers', stats?.pendingSellers ?? '—', 'text-amber-300'],
          ['Pending products', stats?.pendingProducts ?? '—', 'text-amber-300'],
        ].map(([label, val, cls]) => (
          <div key={label} className="card px-4 py-4">
            <div className={`truncate text-xl font-extrabold ${cls}`}>{val}</div>
            <div className="text-xs tracking-wide text-slate-400 uppercase">{label}</div>
          </div>
        ))}
      </div>

      {tab === 'sellers' && (
        <section>
          <div className="mb-4">
            <Chips value={sellerStatus} onChange={setSellerStatus}
              options={[['pending', '⏳ Pending'], ['approved', '✔ Approved'], ['rejected', '✖ Rejected'], ['', 'All']]} />
          </div>

          {sellers.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">No sellers in this view.</div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs tracking-wider text-slate-400 uppercase">
                    <th className="px-5 py-3">Seller</th>
                    <th className="px-3 py-3">Store</th>
                    <th className="px-3 py-3">License</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Joined</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => (
                    <tr key={s._id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                      <td className="px-5 py-3">
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </td>
                      <td className="px-3 py-3">{s.shopName || '—'}</td>
                      <td className="px-3 py-3">
                        {s.licenseUrl ? (
                          <a href={s.licenseUrl} target="_blank" rel="noreferrer"
                            className="badge cursor-pointer bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
                            title={s.licenseOriginalName || 'View license document'}>
                            📄 View license
                          </a>
                        ) : (
                          <span className="badge bg-red-500/10 text-red-300" title="No license on file — approval blocked">none</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><span className={`badge ${SELLER_STATUS[s.status]}`}>{s.status}</span></td>
                      <td className="px-3 py-3 text-xs text-slate-500">{fmtDate(s.createdAt)}</td>
                      <td className="space-x-2 px-5 py-3 text-right whitespace-nowrap">
                        {s.status !== 'approved' && s.licenseUrl && (
                          <button onClick={() => setSellerState(s._id, 'approved')} className="btn-primary px-3 py-1.5 text-xs">Approve</button>
                        )}
                        {s.status !== 'approved' && !s.licenseUrl && (
                          <span className="text-[11px] text-slate-500" title="Upload missing — seller must re-register with a license">
                            license required
                          </span>
                        )}
                        {s.status !== 'rejected' && (
                          <button onClick={() => setSellerState(s._id, 'rejected')} className="btn-danger px-3 py-1.5 text-xs">Reject</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'products' && (
        <section>
          <div className="mb-4">
            <Chips value={productStatus} onChange={setProductStatus}
              options={[['pending', '⏳ Pending review'], ['approved', '✔ Live'], ['draft', '📝 Drafts'], ['rejected', '✖ Rejected'], ['', 'All']]} />
          </div>

          {products.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">Nothing here right now.</div>
          ) : (
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p._id} className="card flex flex-wrap items-center gap-4 p-4">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="h-14 w-14 rounded-lg border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/5">📱</div>
                  )}
                  <div className="min-w-[200px] flex-1">
                    <div className="font-bold">{p.name} {p.featured && <span title="Featured">⭐</span>}</div>
                    <div className="text-xs text-slate-500 capitalize">
                      {p.brand} · {p.category} · by {p.seller?.shopName || p.seller?.name || 'unknown'} · {fmtDate(p.createdAt)}
                    </div>
                  </div>
                  <span className="font-bold text-cyan-300">{fmtMoney(p.price)}</span>
                  <span className={`badge ${PRODUCT_STATUS[p.status]}`}>{p.status}</span>
                  <div className="flex flex-wrap gap-2">
                    {p.status !== 'approved' ? (
                      <>
                        <button onClick={() => setProductState(p._id, 'approved')} className="btn-primary px-3 py-1.5 text-xs">✔ Approve & publish</button>
                        <button onClick={() => setProductState(p._id, 'rejected')} className="btn-danger px-3 py-1.5 text-xs">Reject</button>
                      </>
                    ) : (
                      <>
                        <Link to={`/products/${p._id}`} className="btn-ghost px-3 py-1.5 text-xs">View</Link>
                        <button onClick={() => toggleFeatured(p)} className="btn-ghost px-3 py-1.5 text-xs">{p.featured ? '★ Unfeature' : '☆ Feature'}</button>
                        <button onClick={() => setProductState(p._id, 'rejected')} className="btn-danger px-3 py-1.5 text-xs">Unlist</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'orders' && (
        <section>
          <div className="mb-4">
            <Chips value={orderStatus} onChange={setOrderStatus}
              options={[['', 'All'], ['placed', '⏳ Placed'], ['confirmed', '✔ Confirmed'], ['shipped', '🚚 Shipped'], ['delivered', '📦 Delivered'], ['cancelled', '✖ Cancelled']]} />
          </div>

          {orders.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">No orders in this view.</div>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o._id} className="card p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono text-xs text-slate-400">#{o._id.slice(-8).toUpperCase()}</span>
                    <span className="text-slate-500">{fmtDate(o.createdAt)}</span>
                    <span className="text-slate-400">
                      by <span className="font-semibold text-slate-200">{o.user?.name || 'customer'}</span>
                      <span className="text-xs text-slate-500"> · {o.user?.email}</span>
                    </span>
                    <span className={`badge ml-auto ${ORDER_STATUS[o.status] || 'bg-white/10'}`}>{o.status}</span>
                  </div>

                  <div className="mb-3 space-y-1 text-sm">
                    {o.items.map((it, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-slate-300">{it.name} × {it.qty}</span>
                        <span className="font-semibold">{fmtMoney(it.unitPrice * it.qty)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                    <span className="text-sm text-slate-400">
                      {{ cod: '💵 COD', chapa: '🟢 Chapa', telebirr: '📱 Telebirr', bank_transfer: '🏦 Bank' }[o.paymentMethod] || o.paymentMethod}
                      {o.paymentProof?.screenshotUrl && (
                        <a href={o.paymentProof.screenshotUrl} target="_blank" rel="noreferrer" className="ml-1 text-cyan-300 hover:underline" title={`ref ${o.paymentProof.transactionRef}`}>
                          · receipt
                        </a>
                      )}
                      {' · '}{o.shippingAddress?.city}, {o.shippingAddress?.country} ·{' '}
                      <span className="font-extrabold text-cyan-300">{fmtMoney(o.total)}</span>
                    </span>
                    <div className="ml-auto flex flex-wrap gap-2">
                      {o.status === 'placed' && (
                        <span className="badge bg-amber-500/15 text-amber-300">⏳ awaiting seller confirmation</span>
                      )}
                      {o.status === 'confirmed' && (
                        <button onClick={() => setOrderState(o._id, 'shipped')} className="btn-primary px-3 py-1.5 text-xs">Mark shipped</button>
                      )}
                      {o.status === 'shipped' && (
                        <button onClick={() => setOrderState(o._id, 'delivered')} className="btn-primary px-3 py-1.5 text-xs">Mark delivered</button>
                      )}
                      {['placed', 'confirmed', 'shipped'].includes(o.status) && (
                        <button onClick={() => setOrderState(o._id, 'cancelled')} className="btn-danger px-3 py-1.5 text-xs">Cancel (restock)</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
