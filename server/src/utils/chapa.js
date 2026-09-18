/**
 * Chapa payment integration (Ethiopia) — hosted-checkout mode.
 *
 * Flow:
 *   1. placeOrder('chapa') → initialize() creates a Chapa transaction and
 *      returns a hosted-checkout URL; the customer pays there.
 *   2. Chapa redirects the customer back to the SPA callback route and (if
 *      configured in the Chapa dashboard) POSTs a webhook to
 *      /api/payments/chapa/webhook — both call this service.
 *   3. verify(txRef) asks Chapa's API for the transaction status; a successful
 *      verification auto-confirms the order (stock already reserved at
 *      placement). The seller can still see the proof in the Seller Hub.
 *
 * Keys come from .env: CHAPA_SECRET_KEY / CHAPA_PUBLIC_KEY. GATEWAY_* names
 * are accepted for compatibility with older local environments.
 */
const CHAPA_BASE = 'https://api.chapa.co/v1';

const secret = () => process.env.CHAPA_SECRET_KEY || process.env.GATEWAY_SECRET_KEY || '';
const public_ = () => process.env.CHAPA_PUBLIC_KEY || process.env.GATEWAY_PUBLIC_KEY || '';
const isConfigured = () => Boolean(secret() && public_());

/** Build a unique, deterministic transaction reference for an order. */
function txRefFor(orderId) {
  return `VOLTIX-${String(orderId).slice(-10).toUpperCase()}`;
}

/**
 * Initialize a Chapa hosted-checkout transaction for an order.
 * Returns { checkoutUrl, txRef } or throws Error with a user-safe message.
 */
async function initialize({ order, user, clientOrigin = '', apiOrigin = '' }) {
  if (!isConfigured()) {
    throw new Error('Chapa is not configured — set CHAPA_SECRET_KEY and CHAPA_PUBLIC_KEY in the server environment.');
  }

  const txRef = txRefFor(order._id);
  const payload = {
    public_key: public_(),
    tx_ref: txRef,
    amount: String(order.total),
    currency: 'ETB',
    email: user.email || 'customer@voltix.com',
    first_name: (order.shippingAddress?.fullName || user.name || 'Customer').split(' ')[0],
    last_name: (order.shippingAddress?.fullName || user.name || '').split(' ').slice(1).join(' ') || 'Voltix',
    phone: order.shippingAddress?.phone || '',
    title: `Voltix order #${String(order._id).slice(-8).toUpperCase()}`,
    description: `Payment for ${order.items.length} item(s) on Voltix marketplace`,
    callback_url: `${apiOrigin}/api/payments/chapa/callback`,
    return_url: `${clientOrigin}/orders`,
    /* let the customer pick Telebirr / Card / etc. inside Chapa's UI */
    customization: { title: 'Voltix Marketplace', description: 'Electronics in 3D' },
    meta: { orderId: String(order._id) },
  };

  const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success' || !data.data?.checkout_url) {
    throw new Error(data.message || 'Chapa rejected the transaction initialization.');
  }
  return { checkoutUrl: data.data.checkout_url, txRef };
}

/**
 * Ask Chapa for the authoritative status of a transaction.
 * Returns { verified: boolean, status: string, raw }.
 */
async function verify(txRef) {
  if (!isConfigured() || !txRef) return { verified: false, status: 'unconfigured', raw: null };

  const res = await fetch(`${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secret()}` },
  });
  const data = await res.json().catch(() => ({}));
  const status = data?.data?.status || data?.status || 'unknown';
  return { verified: status === 'success', status, raw: data?.data || null };
}

/** Webhook payloads carry the tx_ref under several shapes; normalize it. */
function extractTxRef(body = {}) {
  return body?.tx_ref || body?.trx_ref || body?.data?.tx_ref || body?.data?.trx_ref || body?.data?.reference || '';
}

module.exports = { isConfigured, initialize, verify, txRefFor, extractTxRef };
