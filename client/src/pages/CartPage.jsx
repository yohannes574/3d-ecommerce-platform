import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cartApi, errMsg } from '../api/client';
import { useCart } from '../context/CartContext';
import { fmtMoney, FREE_SHIPPING_OVER, SHIPPING_FEE } from '../constants';
import { toast } from '../utils/toast';

export default function CartPage() {
  const { setCount } = useCart();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    cartApi
      .get()
      .then((d) => {
        setCart(d.cart); // API shape: { cart: { items, ... }, count, subtotal }
        setCount(d.count);
      })
      .catch((e) => setError(errMsg(e)));
  }, [setCount]);

  useEffect(load, [load]);

  const changeQty = async (item, qty) => {
    try {
      await cartApi.update(item._id, qty);
      load();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  const removeItem = async (itemId) => {
    try {
      await cartApi.remove(itemId);
      load();
      toast('Item removed', 'info');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <div className="card p-12">
          <div className="mb-3 text-5xl">⚠️</div>
          <h1 className="text-lg font-bold">Couldn't load your cart</h1>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <button onClick={load} className="btn-primary mt-5">Try again</button>
          <p className="mt-3 text-xs text-slate-500">
            Not logged in as a customer? <Link to="/login" className="text-cyan-300 hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!cart) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="skeleton h-64" /></div>;

  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <div className="card p-12">
          <div className="mb-4 text-6xl">🛒</div>
          <h1 className="text-xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-slate-400">Explore phones in 3D and add your favorite.</p>
          <Link to="/products" className="btn-primary mt-6">Browse products →</Link>
        </div>
      </div>
    );
  }

  const subtotal = cart.items.reduce((s, i) => s + (i.product?.price || 0) * i.qty, 0);
  const itemCount = cart.items.reduce((s, i) => s + i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="mb-5 text-2xl font-extrabold">Shopping cart ({itemCount})</h1>
        <div className="space-y-3">
          {cart.items.map((item) => {
            const p = item.product;
            /* per-variant unit price: base + the priceDelta of each chosen option */
            const unit = (() => {
              if (!p) return 0;
              let total = p.price;
              for (const sel of item.variant || []) {
                const g = (p.variants || []).find((gr) => gr.name.toLowerCase() === String(sel.name || '').toLowerCase());
                const opt = g?.values?.find((o) => o.value === sel.value);
                if (opt) total += opt.priceDelta || 0;
              }
              return Math.max(0, total);
            })();
            return (
              <div key={item._id} className="card flex items-center gap-4 p-3 sm:p-4">
                <img src={p?.images?.[0]} alt={p?.name}
                  className="h-20 w-20 rounded-lg border border-white/10 object-cover" />
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${p?._id}`} className="block truncate font-bold hover:text-cyan-200">{p?.name}</Link>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {p && fmtMoney(unit)} each
                    {item.variant?.map((v) => (
                      <span key={v.name} className="badge ml-2 bg-white/10 text-slate-300">{v.value}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center rounded-lg border border-white/10 bg-white/5 text-sm">
                  <button className="cursor-pointer px-3 py-2 hover:text-cyan-300" onClick={() => changeQty(item, item.qty - 1)}>−</button>
                  <span className="w-7 text-center font-bold">{item.qty}</span>
                  <button className="cursor-pointer px-3 py-2 hover:text-cyan-300" onClick={() => changeQty(item, item.qty + 1)}>+</button>
                </div>
                <div className="w-24 text-right font-bold">{fmtMoney(unit * item.qty)}</div>
                <button className="cursor-pointer text-slate-500 hover:text-red-400" title="Remove"
                  onClick={() => removeItem(item._id)}>✕</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- summary ---------- */}
      <div>
        <div className="card sticky top-24 p-6">
          <h2 className="mb-4 text-lg font-bold">Summary</h2>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>{shipping === 0 ? <em className="text-emerald-300">Free</em> : fmtMoney(shipping)}</span>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-indigo-300">Add {fmtMoney(FREE_SHIPPING_OVER - subtotal)} more for free shipping.</p>
            )}
            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-extrabold text-white">
              <span>Total</span><span>{fmtMoney(subtotal + shipping)}</span>
            </div>
          </div>
          <Link to="/checkout" className="btn-primary mt-6 w-full py-3">Proceed to checkout →</Link>
          <Link to="/products" className="btn-ghost mt-2 w-full">Keep shopping</Link>
        </div>
      </div>
    </div>
  );
}
