import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi, orderApi, uploadPaymentProof, errMsg } from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, FREE_SHIPPING_OVER, SHIPPING_FEE } from '../constants';
import { toast } from '../utils/toast';

/* Chapa uses hosted checkout; manual receipt uploads are for the other prepaid methods. */
const PAYMENT_OPTIONS = [
  { value: 'cod', icon: '💵', label: 'Cash on Delivery', hint: 'Pay in cash when your order arrives' },
  { value: 'chapa', icon: '🟢', label: 'Chapa', hint: 'Pay securely in Chapa checkout' },
  { value: 'telebirr', icon: '📱', label: 'Telebirr', hint: 'Pay via Telebirr and upload your receipt' },
  { value: 'bank_transfer', icon: '🏦', label: 'Bank Transfer', hint: 'CBE / Awash / Dashen — upload the transfer slip' },
];
const MANUAL_PROOF_METHODS = ['telebirr', 'bank_transfer'];

const FIELDS = [
  ['fullName', 'Full name'],
  ['phone', 'Phone number'],
  ['line1', 'Address line'],
  ['city', 'City'],
  ['country', 'Country'],
];

export default function Checkout() {
  const navigate = useNavigate();
  const { clearCount } = useCart();
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [address, setAddress] = useState({
    fullName: user?.address?.fullName || user?.name || '',
    phone: user?.address?.phone || '',
    line1: user?.address?.line1 || '',
    city: user?.address?.city || '',
    country: user?.address?.country || '',
  });
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [txRef, setTxRef] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    cartApi.get().then((d) => setCart(d.cart)).catch(() => {});
  }, []);

  function pickProof(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      return toast('Receipt must be a JPG, PNG or WebP image.', 'error');
    }
    if (f.size > 5 * 1024 * 1024) return toast('Receipt must be under 5 MB.', 'error');
    setProofFile(f);
    setProofPreview(URL.createObjectURL(f));
  }

  const place = async (e) => {
    e.preventDefault();
    if (!cart?.items.length) return toast('Your cart is empty.', 'error');
    if (Object.values(address).some((v) => !v.trim())) return toast('Fill in every address field.', 'error');

    let paymentProof;
    if (MANUAL_PROOF_METHODS.includes(paymentMethod)) {
      if (!proofFile) return toast('Upload your payment screenshot first.', 'error');
      if (!txRef.trim()) return toast('Enter the transaction reference number.', 'error');
    }

    setPlacing(true);
    try {
      if (MANUAL_PROOF_METHODS.includes(paymentMethod)) {
        const up = await uploadPaymentProof(proofFile);
        paymentProof = { screenshotUrl: up.url, transactionRef: txRef.trim() };
      }
      const d = await orderApi.place({ shippingAddress: address, paymentMethod, paymentProof });
      clearCount();
      if (d.checkoutUrl) {
        toast('Redirecting to Chapa to complete payment…', 'info');
        window.location.href = d.checkoutUrl;
        return;
      }
      toast(MANUAL_PROOF_METHODS.includes(paymentMethod)
        ? 'Order placed! The seller will verify your payment 🎉'
        : 'Order placed! Pay on delivery 🎉');
      navigate('/orders');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (!cart) return <div className="mx-auto max-w-3xl px-4 py-10"><div className="skeleton h-64" /></div>;
  if (!cart.items.length) {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <div className="card p-12">
          <div className="mb-3 text-5xl">🧾</div>
          <h1 className="text-lg font-bold">Nothing to check out</h1>
          <Link to="/products" className="btn-primary mt-5">Browse products</Link>
        </div>
      </div>
    );
  }

  const subtotal = cart.items.reduce((s, i) => s + (i.product?.price || 0) * i.qty, 0);
  const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
      <form onSubmit={place} className="card p-6">
        <h1 className="mb-1 text-2xl font-extrabold">Checkout</h1>
        <p className="mb-6 text-sm text-slate-400">Where should we deliver your new phone?</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(([key, label]) => (
            <div key={key} className={key === 'line1' ? 'sm:col-span-2' : ''}>
              <label className="label">{label}</label>
              <input
                className="input"
                value={address[key]}
                onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                placeholder={label}
              />
            </div>
          ))}
        </div>

        <h2 className="mt-8 mb-3 font-bold">Payment</h2>
        <div className="space-y-2">
          {PAYMENT_OPTIONS.map((opt) => {
            const active = paymentMethod === opt.value;
            return (
              <label key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                  active ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'
                }`}>
                <input type="radio" className="accent-cyan-400" checked={active} onChange={() => setPaymentMethod(opt.value)} />
                <span>{opt.icon} <b>{opt.label}</b></span>
                <span className="ml-auto hidden text-xs text-slate-500 sm:block">{opt.hint}</span>
              </label>
            );
          })}
        </div>

        {MANUAL_PROOF_METHODS.includes(paymentMethod) && (
          <div className="mt-4 rounded-xl border border-indigo-400/30 bg-indigo-500/5 p-4">
            <h3 className="mb-1 text-sm font-bold">📋 Upload payment proof</h3>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              {paymentMethod === 'bank_transfer'
                ? 'Transfer the total to our bank account (shown after checkout), then upload the transfer slip and enter the reference number.'
                : 'Pay the total via Telebirr to our merchant number, then upload the receipt screenshot and enter the transaction ID. The seller verifies it before confirming the order.'}
            </p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickProof} />
            <div className="flex flex-wrap items-center gap-3">
              {proofPreview ? (
                <img src={proofPreview} alt="receipt preview" className="h-16 w-16 rounded-lg border border-white/20 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-white/20 text-xl">🧾</div>
              )}
              <button type="button" className="btn-ghost px-3 py-2 text-xs" onClick={() => fileRef.current?.click()}>
                {proofFile ? 'Replace screenshot' : 'Choose screenshot'}
              </button>
              {proofFile && <span className="max-w-[180px] truncate text-xs text-emerald-300">✓ {proofFile.name}</span>}
            </div>
            <div className="mt-3">
              <label className="label">{paymentMethod === 'bank_transfer' ? 'Transfer reference (FT/No.)' : 'Transaction ID'}</label>
              <input className="input" value={txRef} onChange={(e) => setTxRef(e.target.value)}
                placeholder={paymentMethod === 'chapa' ? 'e.g. CH-9F2K1L4M' : paymentMethod === 'telebirr' ? 'e.g. TB2451088..' : 'e.g. FT2510ZXY4K'} />
            </div>
          </div>
        )}

        <button className="btn-primary mt-8 w-full py-3" disabled={placing}>
          {placing
            ? 'Placing order…'
            : paymentMethod === 'chapa'
              ? `Pay with Chapa · ${fmtMoney(subtotal + shipping)}`
              : `Place order · ${fmtMoney(subtotal + shipping)}`}
        </button>
      </form>

      <div className="card sticky top-24 h-fit p-6">
        <h2 className="mb-4 font-bold">Your items</h2>
        <div className="max-h-72 space-y-3 overflow-auto pr-1">
          {cart.items.map((i) => {
            const p = i.product;
            const unit = (() => {
              if (!p) return 0;
              let total = p.price;
              for (const sel of i.variant || []) {
                const g = (p.variants || []).find((gr) => gr.name.toLowerCase() === String(sel.name || '').toLowerCase());
                const opt = g?.values?.find((o) => o.value === sel.value);
                if (opt) total += opt.priceDelta || 0;
              }
              return Math.max(0, total);
            })();
            return (
              <div key={i._id} className="flex items-center gap-3 text-sm">
                <img src={p?.images?.[0]} alt="" className="h-12 w-12 rounded-md border border-white/10 object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p?.name} × {i.qty}</div>
                  {i.variant?.length > 0 && (
                    <div className="truncate text-xs text-slate-500">{i.variant.map((v) => v.value).join(', ')}</div>
                  )}
                </div>
                <span className="font-semibold">{fmtMoney(unit * i.qty)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm text-slate-400">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{shipping ? fmtMoney(shipping) : 'Free'}</span></div>
          <div className="flex justify-between pt-2 text-base font-extrabold text-white"><span>Total</span><span>{fmtMoney(subtotal + shipping)}</span></div>
        </div>
      </div>
    </div>
  );
}
