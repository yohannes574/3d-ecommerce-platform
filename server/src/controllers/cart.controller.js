const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { ApiError, asyncHandler } = require('../utils/helpers');
const { stockFor } = require('../utils/stock');

const variantSig = (v = []) =>
  JSON.stringify([...v].map((x) => `${x.name}:${x.value}`).sort());

async function getCart(userId) {
  let cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    select: 'name price variants stock status',
  });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });

  // drop items whose product was removed/unapproved
  const before = cart.items.length;
  cart.items = cart.items.filter((i) => i.product && i.product.status === 'approved');
  if (cart.items.length !== before) await cart.save();
  return cart;
}

/** Variant-aware unit price for a cart line (falls back to base price). */
function lineUnitPrice(item) {
  const p = item.product;
  if (!p) return 0;
  if (typeof p.priceFor === 'function') return p.priceFor(item.variant);
  return p.price; // lean()ed documents have no doc methods
}

/** GET /api/cart */
exports.getCart = asyncHandler(async (req, res) => {
  const cart = await getCart(req.user._id);
  const subtotal = cart.items.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0);
  res.json({
    cart,
    count: cart.items.reduce((s, i) => s + i.qty, 0),
    subtotal,
  });
});

/** POST /api/cart {productId, qty?, variant?:[{name,value}]} */
exports.addItem = asyncHandler(async (req, res) => {
  const { productId, qty = 1, variant = [] } = req.body;
  if (!productId) throw new ApiError(400, 'productId is required.');

  const product = await Product.findById(productId);
  if (!product || product.status !== 'approved') throw new ApiError(404, 'Product not available.');
  if (product.stock < 1) throw new ApiError(400, 'This product is out of stock.');

  /* respect per-option stock when the selection tracks its own inventory */
  const available = stockFor(product, variant);
  if (available < 1) {
    throw new ApiError(400, 'The selected option is out of stock — pick another.');
  }

  const quantity = Math.max(1, Math.min(parseInt(qty, 10) || 1, available));
  const cart = await getCart(req.user._id);

  const sig = variantSig(variant);
  const existing = cart.items.find(
    (i) => i.product.equals(productId) && variantSig(i.variant) === sig
  );

  if (existing) {
    existing.qty = Math.min(existing.qty + quantity, available);
  } else {
    cart.items.push({ product: productId, qty: quantity, variant });
  }
  await cart.save();

  const count = cart.items.reduce((s, i) => s + i.qty, 0);
  res.status(201).json({ message: 'Added to cart.', count });
});

/** PATCH /api/cart/:itemId {qty} */
exports.updateItem = asyncHandler(async (req, res) => {
  const qty = parseInt(req.body.qty, 10);
  const cart = await getCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, 'Cart item not found.');

  const product = await Product.findById(item.product);
  const max = product ? Math.max(stockFor(product, item.variant), 1) : 99;
  item.qty = Math.max(1, Math.min(qty || 1, max));
  await cart.save();

  res.json({ message: 'Cart updated.', item });
});

/** DELETE /api/cart/:itemId */
exports.removeItem = asyncHandler(async (req, res) => {
  const cart = await getCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw new ApiError(404, 'Cart item not found.');
  item.deleteOne();
  await cart.save();
  res.json({ message: 'Item removed.' });
});
