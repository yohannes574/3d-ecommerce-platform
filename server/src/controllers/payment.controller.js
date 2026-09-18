/**
 * Payment endpoints for Chapa (hosted checkout).
 *
 *   POST /api/payments/chapa/init     {orderId} → { checkoutUrl }   (customer)
 *   GET  /api/payments/chapa/callback ?tx_ref=&status= → 302 to the SPA  (browser)
 *   POST /api/payments/chapa/webhook  Chapa event → 200               (Chapa servers)
 *
 * Security model: callback and webhook payloads are treated as HINTS only.
 * The authoritative state always comes from verify(txRef) against Chapa's
 * API before an order is auto-confirmed.
 */
const Order = require('../models/Order');
const Product = require('../models/Product');
const { ApiError, asyncHandler } = require('../utils/helpers');
const { notify } = require('../utils/notify');
const { logAudit } = require('../utils/audit');
const chapa = require('../utils/chapa');

const clientOrigin = () => process.env.CLIENT_ORIGIN || 'http://localhost:5173';

/**
 * Look up the order behind a tx_ref (we store the ref on the order at
 * initialization) and — if Chapa reports success — auto-confirm it.
 * Idempotent: confirming twice is a no-op.
 */
async function settleChapaPayment(txRef) {
  const order = await Order.findOne({ 'paymentProof.transactionRef': txRef });
  if (!order) return { found: false, verified: false, status: 'unknown-order' };
  if (order.paymentMethod !== 'chapa') return { found: true, verified: false, status: 'not-chapa' };

  const { verified, status } = await chapa.verify(txRef);
  if (!verified || order.status !== 'placed') {
    return { found: true, verified, status, order };
  }

  order.paymentProof.uploadedAt = order.paymentProof.uploadedAt || new Date();
  if (!order.paymentProof.screenshotUrl) {
    order.paymentProof.screenshotUrl = `chapa://verified/${txRef}`; // electronic proof marker
  }
  order.status = 'confirmed';
  await order.save();

  logAudit({ ip: 'chapa' }, 'order.chapa_verified', {
    target: `Order:${order._id}`,
    meta: { txRef, chapaStatus: status },
  });

  const orderRef = String(order._id).slice(-8).toUpperCase();
  await notify({
    userId: order.user,
    type: 'order',
    title: `Payment verified — order #${orderRef} confirmed ✅`,
    body: 'Chapa confirmed your payment. The seller is preparing your order.',
    link: '/orders',
  });
  const sellerIds = [...new Set(order.items.map((i) => String(i.product)).filter(Boolean))];
  const sellerDocs = await Product.find({ _id: { $in: sellerIds } }).populate('seller', 'email');
  for (const p of sellerDocs) {
    if (!p.seller) continue;
    await notify({
      userId: p.seller._id,
      email: p.seller.email,
      type: 'order',
      title: `Chapa payment verified for order #${orderRef}`,
      body: 'Payment confirmed electronically — you can prepare the shipment.',
      link: '/seller',
    });
  }

  return { found: true, verified: true, status, order };
}

/** GET /api/payments/config — public: which payment capabilities are live */
exports.paymentConfig = (req, res) => {
  res.json({
    chapaElectronic: chapa.isConfigured(), // true = hosted checkout + server verification
  });
};

/** POST /api/payments/chapa/init { orderId } — (re)open the hosted checkout */
exports.chapaInit = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.body.orderId, user: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.paymentMethod !== 'chapa') throw new ApiError(400, 'This order is not a Chapa order.');
  if (order.status !== 'placed') throw new ApiError(400, `This order is already "${order.status}".`);

  const { checkoutUrl, txRef } = await chapa.initialize({
    order,
    user: req.user,
    clientOrigin: clientOrigin(),
    apiOrigin: process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 5000}`,
  });
  if (!order.paymentProof.transactionRef) {
    order.paymentProof.transactionRef = txRef;
    await order.save();
  }
  res.json({ checkoutUrl, txRef });
});

/** GET /api/payments/chapa/callback — Chapa redirects the customer here */
exports.chapaCallback = asyncHandler(async (req, res) => {
  const txRef = chapa.extractTxRef(req.query) || req.query.tx_ref;
  let outcome = 'failed';
  try {
    const result = await settleChapaPayment(txRef);
    outcome = result.verified ? 'success' : 'failed';
  } catch {
    outcome = 'failed';
  }
  res.redirect(`${clientOrigin()}/orders?chapa=${outcome}`);
});

/** POST /api/payments/chapa/webhook — Chapa event push; re-verified via API */
exports.chapaWebhook = asyncHandler(async (req, res) => {
  const txRef = chapa.extractTxRef(req.body);
  if (!txRef) return res.status(200).json({ received: true, matched: false });
  try {
    await settleChapaPayment(txRef);
  } catch (err) {
    console.warn('[chapa webhook] settlement failed:', err.message);
  }
  res.status(200).json({ received: true });
});
