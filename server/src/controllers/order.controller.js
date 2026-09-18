const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ApiError, asyncHandler } = require('../utils/helpers');
const { decrementStock, incrementStock, stockFor } = require('../utils/stock');
const { notify } = require('../utils/notify');
const { logAudit } = require('../utils/audit');
const chapa = require('../utils/chapa');

const FREE_SHIPPING_OVER = 99;
const SHIPPING_FEE = 12;
const PAYMENT_METHODS = ['cod', 'chapa', 'telebirr', 'bank_transfer'];
const PREPAID = ['chapa', 'telebirr', 'bank_transfer'];

/** POST /api/orders — place an order from the current cart (COD or pre-paid with proof) */
exports.placeOrder = asyncHandler(async (req, res) => {
  if (!req.user.isVerified) {
    throw new ApiError(403, 'Verify your email before placing orders — check your inbox for the link.');
  }

  const { fullName, phone, line1, city, country } = req.body.shippingAddress || {};
  if (!fullName || !phone || !line1 || !city || !country) {
    throw new ApiError(400, 'Complete shipping address is required.');
  }

  /* Telebirr and bank transfer are manually verified from an uploaded receipt.
     Chapa is always paid and verified through its hosted checkout. */
  const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod)
    ? req.body.paymentMethod
    : 'cod';
  if (paymentMethod === 'chapa' && !chapa.isConfigured()) {
    throw new ApiError(503, 'Chapa payments are not configured. Set CHAPA_SECRET_KEY and CHAPA_PUBLIC_KEY on the server.');
  }
  let paymentProof;
  const chapaElectronic = paymentMethod === 'chapa' && chapa.isConfigured();
  if (paymentMethod === 'telebirr' || paymentMethod === 'bank_transfer') {
    const { screenshotUrl, transactionRef } = req.body.paymentProof || {};
    if (!screenshotUrl || !String(screenshotUrl).startsWith('/uploads/')) {
      throw new ApiError(400, 'A payment receipt is required for Telebirr or bank transfer.');
    }
    if (!transactionRef || !String(transactionRef).trim()) {
      throw new ApiError(400, 'A transaction reference is required for this payment method.');
    }
    paymentProof = { screenshotUrl, transactionRef: String(transactionRef).trim(), uploadedAt: new Date() };
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate({
    path: 'items.product',
    select: 'name price variants images stock status',
  });
  if (!cart || cart.items.length === 0) throw new ApiError(400, 'Your cart is empty.');

  // build snapshots with variant-aware pricing, then ATOMICALLY decrement stock.
  // decrementStock re-checks every counter inside the DB, so concurrent orders
  // can never oversell; a failure aborts the whole order.
  const items = [];
  let subtotal = 0;
  for (const item of cart.items) {
    const p = item.product;
    if (!p || p.status !== 'approved') continue;

    const unitPrice = p.priceFor(item.variant);
    subtotal += unitPrice * item.qty;
    items.push({
      product: p._id,
      name: p.name,
      image: p.images?.[0] || '',
      unitPrice,
      qty: item.qty,
      variant: item.variant,
      _doc: p, // populated doc for the atomic decrement below
    });
  }
  if (items.length === 0) throw new ApiError(400, 'No purchasable items in your cart.');

  for (const item of items) {
    await decrementStock(item._doc, item.variant, item.qty);
    delete item._doc; // never persist this helper field
  }

  const shippingFee = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
  const order = await Order.create({
    user: req.user._id,
    items,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    paymentMethod,
    ...(paymentProof ? { paymentProof } : {}),
    shippingAddress: { fullName, phone, line1, city, country },
  });

  cart.items = [];
  await cart.save();

  /* notify the customer + every seller whose products were ordered */
  const orderRef = String(order._id).slice(-8).toUpperCase();
  const payLabel = { cod: 'Pay on delivery', chapa: 'Chapa — complete payment at the checkout page',
    telebirr: 'Telebirr — awaiting seller verification', bank_transfer: 'Bank transfer — awaiting seller verification' }[paymentMethod];
  await notify({
    userId: req.user._id,
    email: req.user.email,
    type: 'order',
    title: `Order #${orderRef} placed`,
    body: `${items.length} item(s), total $${order.total}. ${payLabel}.`,
    link: '/orders',
  });
  const sellerIds = [...new Set(items.map((i) => String(i.product)))];
  const sellerDocs = await Product.find({ _id: { $in: sellerIds } }).populate('seller', 'email');
  const uniqueSellers = new Map();
  for (const p of sellerDocs) {
    if (p.seller) uniqueSellers.set(String(p.seller._id), p.seller.email);
  }
  for (const [sellerId, email] of uniqueSellers) {
    await notify({
      userId: sellerId,
      email,
      type: 'order',
      title: 'New order to confirm 🛒',
      body: `Order #${orderRef} (${paymentMethod === 'cod' ? 'cash on delivery' : paymentMethod}) needs your confirmation.`,
      link: '/seller',
    });
  }

  /* Chapa electronic mode: create the hosted-checkout transaction right away
     and hand the checkout URL back to the SPA, which redirects the customer.
     If Chapa is unreachable the order still stands — the customer can retry
     the checkout later from the Orders page. */
  let checkoutUrl;
  if (chapaElectronic) {
    try {
      const init = await chapa.initialize({
        order,
        user: req.user,
        clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
        apiOrigin: process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 5000}`,
      });
      order.paymentProof = {
        screenshotUrl: '',
        transactionRef: init.txRef,
        uploadedAt: new Date(),
      };
      await order.save();
      checkoutUrl = init.checkoutUrl;
    } catch (err) {
      console.warn('[chapa] initialize failed — customer can retry from Orders:', err.message);
    }
  }

  res.status(201).json({ order, message: paymentMethod === 'cod'
    ? 'Order placed! Pay on delivery.'
    : chapaElectronic
      ? 'Order placed! Redirecting you to Chapa to complete the payment…'
      : 'Order placed! The seller will verify your payment and confirm.',
    ...(checkoutUrl ? { checkoutUrl } : {}) });
});

/** GET /api/orders/mine */
exports.myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
});

/** PATCH /api/orders/:id/cancel — customer cancels a not-yet-shipped order */
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.status !== 'placed' && order.status !== 'confirmed') {
    throw new ApiError(400, `A ${order.status} order can no longer be cancelled.`);
  }

  // restock every item we reserved at purchase time (per-option counters too)
  for (const item of order.items) {
    if (!item.product) continue;
    const p = await Product.findById(item.product);
    if (!p) continue;
    await incrementStock(p, item.variant, item.qty);
  }

  order.status = 'cancelled';
  await order.save();

  await notify({
    userId: order.user,
    type: 'order',
    title: `Order #${String(order._id).slice(-8).toUpperCase()} cancelled`,
    body: 'Your order was cancelled and the items are back in stock.',
    link: '/orders',
  });

  res.json({ order, message: 'Order cancelled and stock restored.' });
});

/* ---------------- Admin: order management ---------------- */

/** GET /api/orders — all orders (admin), optional ?status= */
exports.listOrders = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const orders = await Order.find(filter)
    .populate('user', 'name email')
    .sort({ createdAt: -1 });
  res.json({ orders });
});

/** PATCH /api/orders/:id/status {status} — admin moves the order through the lifecycle */
exports.setOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) {
    throw new ApiError(400, `status must be one of: ${allowed.join(', ')}.`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');

  const wasActive = order.status !== 'cancelled';
  order.status = status;
  await order.save();

  // keep stock truthful: restock when an active order gets cancelled
  if (status === 'cancelled' && wasActive) {
    for (const item of order.items) {
      if (!item.product) continue;
      const p = await Product.findById(item.product);
      if (!p) continue;
      await incrementStock(p, item.variant, item.qty);
    }
  }

  logAudit(req, 'order.status', { target: `Order:${order._id}`, meta: { status } });
  await notify({
    userId: order.user,
    type: 'order',
    title: `Order #${String(order._id).slice(-8).toUpperCase()} is now ${status}`,
    body: status === 'delivered'
      ? 'Delivered! You can now review the products you bought.'
      : `Your order status changed to "${status}".`,
    link: '/orders',
  });

  res.json({ order, message: `Order marked ${status}.` });
});

/* ---------------- Seller: order confirmation ---------------- */

const PAYMENT_LABELS = { cod: 'Cash on delivery', chapa: 'Chapa', telebirr: 'Telebirr', bank_transfer: 'Bank transfer' };

/** Does this order contain at least one product owned by the seller? */
async function sellerOwnsOrderLine(order, sellerId) {
  const productIds = order.items.map((i) => i.product).filter(Boolean);
  if (productIds.length === 0) return false;
  const owned = await Product.countDocuments({ _id: { $in: productIds }, seller: sellerId });
  return owned > 0;
}

/**
 * PATCH /api/orders/:id/confirm — the SELLER confirms an order containing their
 * products. Pre-paid orders (Chapa/Telebirr/bank) can only be confirmed once
 * the customer has attached payment proof; COD orders confirm freely.
 */
exports.sellerConfirmOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (!(await sellerOwnsOrderLine(order, req.user._id))) {
    throw new ApiError(403, 'This order does not contain any of your products.');
  }
  if (order.status !== 'placed') {
    throw new ApiError(400, `Only newly placed orders can be confirmed (this one is "${order.status}").`);
  }
  const prepaid = PREPAID.includes(order.paymentMethod);
  if (order.paymentMethod === 'chapa') {
    if (!order.paymentProof?.transactionRef) {
      throw new ApiError(400, 'The customer has not started the Chapa checkout yet.');
    }
    const { verified, status } = await chapa.verify(order.paymentProof.transactionRef);
    if (!verified) {
      throw new ApiError(400, `Chapa has not confirmed this payment yet (status: ${status}). Ask the customer to complete the checkout.`);
    }
  } else if (prepaid && !order.paymentProof?.screenshotUrl) {
    throw new ApiError(400, 'The customer has not uploaded payment proof yet — ask them to attach their receipt first.');
  }

  order.status = 'confirmed';
  await order.save();

  logAudit(req, 'order.confirm', { target: `Order:${order._id}`, meta: { paymentMethod: order.paymentMethod } });
  await notify({
    userId: order.user,
    type: 'order',
    title: `Order #${String(order._id).slice(-8).toUpperCase()} confirmed ✅`,
    body: prepaid
      ? `${req.user.shopName || 'The seller'} verified your ${PAYMENT_LABELS[order.paymentMethod]} payment. Your order is being prepared.`
      : `${req.user.shopName || 'The seller'} confirmed your order. It will ship soon.`,
    link: '/orders',
  });

  res.json({ order, message: 'Order confirmed — the customer has been notified.' });
});

/**
 * PATCH /api/orders/:id/reject-payment — seller cannot verify the uploaded
 * payment. Restocks everything and cancels the order.
 */
exports.sellerRejectPayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (!(await sellerOwnsOrderLine(order, req.user._id))) {
    throw new ApiError(403, 'This order does not contain any of your products.');
  }
  if (order.status !== 'placed') {
    throw new ApiError(400, `Only newly placed orders can be rejected (this one is "${order.status}").`);
  }
  if (!PREPAID.includes(order.paymentMethod)) {
    throw new ApiError(400, 'COD orders have no payment to verify — cancel the order instead.');
  }

  for (const item of order.items) {
    if (!item.product) continue;
    const p = await Product.findById(item.product);
    if (p) await incrementStock(p, item.variant, item.qty);
  }
  order.status = 'cancelled';
  await order.save();

  logAudit(req, 'order.reject_payment', { target: `Order:${order._id}` });
  await notify({
    userId: order.user,
    type: 'order',
    title: `Payment for order #${String(order._id).slice(-8).toUpperCase()} could not be verified`,
    body: `${req.user.shopName || 'The seller'} could not verify your payment screenshot. Stock has been restored — please contact support or reorder.`,
    link: '/orders',
  });

  res.json({ order, message: 'Payment rejected — order cancelled and stock restored.' });
});

/* ---------------- Seller: orders containing my products ---------------- */

/** GET /api/orders/seller — orders that include at least one of this seller's products */
exports.sellerOrders = asyncHandler(async (req, res) => {
  const myIds = await Product.find({ seller: req.user._id }).distinct('_id');
  const orders = await Order.find({ 'items.product': { $in: myIds } })
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

  // project each order down to the lines that belong to this seller
  const idSet = new Set(myIds.map((id) => String(id)));
  const scoped = orders.map((o) => {
    const plain = o.toJSON();
    plain.items = plain.items.filter((it) => it.product && idSet.has(String(it.product)));
    return plain;
  });

  res.json({ orders: scoped });
});
