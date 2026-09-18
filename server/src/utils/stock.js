const mongoose = require('mongoose');
const { ApiError } = require('./helpers');
const Product = require('../models/Product');

/**
 * Per-variant stock helpers.
 *
 * Model rules:
 *  - Product.stock is the master counter (always decremented).
 *  - An option ({ value, priceDelta, stock }) may carry its OWN stock.
 *    `stock === null` → inherits the product-level counter (untracked).
 *
 * All writes are atomic conditional updates so concurrent orders can never
 * oversell: each decrement re-evaluates "enough stock left?" inside the DB.
 */

const toId = (id) => new mongoose.Types.ObjectId(String(id));

/** Find one option across a product's variant groups by selection signature. */
function findOption(product, selection = []) {
  for (const sel of selection || []) {
    const group = (product.variants || []).find(
      (g) => g.name.toLowerCase() === String(sel.name || '').toLowerCase()
    );
    if (!group) continue;
    const opt = (group.values || []).find(
      (o) => o.value.toLowerCase() === String(sel.value || '').toLowerCase()
    );
    if (opt) return opt;
  }
  return null;
}

/** Options among the selection that actually track their own stock. */
function trackedOptions(product, selection = []) {
  const out = [];
  for (const sel of selection || []) {
    const group = (product.variants || []).find(
      (g) => g.name.toLowerCase() === String(sel.name || '').toLowerCase()
    );
    if (!group) continue;
    const opt = (group.values || []).find(
      (o) => o.value.toLowerCase() === String(sel.value || '').toLowerCase()
    );
    if (opt && opt.stock !== null && opt.stock !== undefined) out.push({ group: group.name, opt });
  }
  return out;
}

/**
 * How many units of this selection are available?
 * min(product.stock, tracked option stocks…). Untracked options → product.stock.
 */
function stockFor(product, selection = []) {
  let available = product.stock || 0;
  for (const { opt } of trackedOptions(product, selection)) {
    available = Math.min(available, opt.stock || 0);
  }
  return available;
}

/**
 * Atomically decrement stock for one cart line. Throws 409 when any counter
 * is insufficient (checked inside the DB update, not in JS). $inc only ever
 * fires if every condition holds, so two racing orders cannot both succeed.
 */
async function decrementStock(product, selection = [], qty) {
  /* 1. master counter */
  const res = await Product.updateOne(
    { _id: toId(product._id), stock: { $gte: qty } },
    { $inc: { stock: -qty } }
  );
  if (res.modifiedCount === 0) {
    throw new ApiError(409, `"${product.name}" just sold out or has insufficient stock. Please update your cart.`);
  }

  /* 2. each tracked option counter */
  for (const { group, opt } of trackedOptions(product, selection)) {
    const res2 = await Product.updateOne(
      {
        _id: toId(product._id),
        variants: {
          $elemMatch: {
            name: group,
            values: { $elemMatch: { value: opt.value, stock: { $gte: qty } } },
          },
        },
      },
      { $inc: { 'variants.$[g].values.$[o].stock': -qty } },
      { arrayFilters: [{ 'g.name': group }, { 'o.value': opt.value }] }
    );
    if (res2.modifiedCount === 0) {
      // roll the master counter back before failing
      await Product.updateOne({ _id: toId(product._id) }, { $inc: { stock: qty } });
      throw new ApiError(409, `"${product.name} — ${opt.value}" just sold out. Please pick another option.`);
    }
  }
}

/** Restock after a cancellation — plain increments (cannot fail on stock). */
async function incrementStock(product, selection = [], qty) {
  await Product.updateOne({ _id: toId(product._id) }, { $inc: { stock: qty } });
  for (const { group, opt } of trackedOptions(product, selection)) {
    await Product.updateOne(
      { _id: toId(product._id) },
      { $inc: { 'variants.$[g].values.$[o].stock': qty } },
      { arrayFilters: [{ 'g.name': group }, { 'o.value': opt.value }] }
    );
  }
}

module.exports = { findOption, trackedOptions, stockFor, decrementStock, incrementStock };
