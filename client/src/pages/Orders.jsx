import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { orderApi, paymentApi, errMsg } from '../api/client';
import { fmtDate, fmtMoney } from '../constants';
import { toast } from '../utils/toast';

const STATUS_STYLE = {
  placed: 'bg-indigo-500/15 text-indigo-300',
  confirmed: 'bg-cyan-500/15 text-cyan-300',
  shipped: 'bg-amber-500/15 text-amber-300',
  delivered: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-red-500/15 text-red-300',
};

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const load = useCallback(() => {
    orderApi.mine().then((d) => setOrders(d.orders)).catch(() => setOrders([]));
  }, []);

  useEffect(load, [load]);

  /* returned from the Chapa hosted checkout: /orders?chapa=success|failed */
  useEffect(() => {
    const chapa = params.get('chapa');
    if (chapa === 'success') toast('Payment verified via Chapa ✅ Your order is confirmed.', 'success');
    if (chapa === 'failed') toast('Chapa payment not completed — you can retry below.', 'error');
    if (chapa) setParams({}, { replace: true });
  }, [params, setParams]);

  const payWithChapa = async (o) => {
    try {
      const d = await paymentApi.chapaInit(o._id);
      window.location.href = d.checkoutUrl;
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const cancel = async (o) => {
    if (!window.confirm(`Cancel order #${o._id.slice(-8).toUpperCase()}? Stock will be restored.`)) return;
    try {
      await orderApi.cancel(o._id);
      toast('Order cancelled.', 'info');
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (!orders) return <div className="mx-auto max-w-4xl px-4 py-10"><div className="skeleton h-48" /></div>;

  if (!orders.length) {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <div className="card p-12">
          <div className="mb-3 text-5xl">📦</div>
          <h1 className="text-lg font-bold">No orders yet</h1>
          <p className="mt-1 text-sm text-slate-400">Your placed orders will show up here.</p>
          <Link to="/products" className="btn-primary mt-5">Start shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-extrabold">My orders</h1>
      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o._id} className="card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-slate-400">#{o._id.slice(-8).toUpperCase()}</span>
              <span className="text-sm text-slate-500">{fmtDate(o.createdAt)}</span>
              <span className={`badge ml-auto ${STATUS_STYLE[o.status] || 'bg-white/10'}`}>{o.status}</span>
              {(o.status === 'placed' || o.status === 'confirmed') && (
                <button onClick={() => cancel(o)} className="btn-danger px-3 py-1.5 text-xs">Cancel order</button>
              )}
              {o.status === 'placed' && o.paymentMethod === 'chapa' && (
                <button onClick={() => payWithChapa(o)} className="btn-primary px-3 py-1.5 text-xs">🟢 Complete payment</button>
              )}
            </div>

            <div className="space-y-2.5">
              {o.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  {it.image ? (
                    <img src={it.image} alt="" className="h-11 w-11 rounded-md border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/5">📱</div>
                  )}
                  <span className="min-w-0 flex-1 truncate">{it.name} × {it.qty}</span>
                  {it.variant?.length > 0 && (
                    <span className="hidden text-xs text-slate-500 sm:block">{it.variant.map((v) => v.value).join(', ')}</span>
                  )}
                  {o.status === 'delivered' && it.product && (
                    <button
                      onClick={() => navigate(`/products/${it.product}#reviews`)}
                      className="badge cursor-pointer bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                      title="Rate this product"
                    >
                      ★ review
                    </button>
                  )}
                  <span className="font-semibold">{fmtMoney(it.unitPrice * it.qty)}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-sm">
              <span className="min-w-0 text-slate-400">
                {{ cod: '💵 Cash on delivery', chapa: '🟢 Chapa', telebirr: '📱 Telebirr', bank_transfer: '🏦 Bank transfer' }[o.paymentMethod] || o.paymentMethod}
                {' · '}{o.shippingAddress.city}, {o.shippingAddress.country}
                {o.paymentProof?.screenshotUrl && (
                  <a href={o.paymentProof.screenshotUrl} target="_blank" rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 align-middle text-cyan-300 hover:underline" title="View uploaded receipt">
                    <img src={o.paymentProof.screenshotUrl} alt="receipt" className="h-6 w-6 rounded border border-white/20 object-cover" />
                    receipt
                  </a>
                )}
              </span>
              <span className="font-extrabold text-cyan-300">{fmtMoney(o.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
