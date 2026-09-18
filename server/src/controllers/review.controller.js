const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { ApiError, asyncHandler } = require('../utils/helpers');

const PAGE_SIZE = 8;

function parseId(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid id.');
  return new mongoose.Types.ObjectId(id);
}

/** POST /api/reviews  { orderItemId: "<orderId>:<itemIndex>", rating, comment? } */
exports.createReview = asyncHandler(async (req, res) => {
  const { orderItemId, rating } = req.body;
  if (!orderItemId || typeof orderItemId !== 'string' || !orderItemId.includes(':')) {
    throw new ApiError(400, 'orderItemId is required.');
  }
  const rate = Number(rating);
  if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
    throw new ApiError(400, 'Rating must be a whole number between 1 and 5.');
  }
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';

  const [orderIdRaw, idxRaw] = orderItemId.split(':');
  const idx = Number(idxRaw);
  if (!mongoose.isValidObjectId(orderIdRaw) || !Number.isInteger(idx) || idx < 0) {
    throw new ApiError(400, 'Invalid orderItemId.');
  }

  const order = await Order.findOne({ _id: orderIdRaw, user: req.user._id });
  if (!order) throw new ApiError(404, 'Order not found.');
  if (order.status !== 'delivered') {
    throw new ApiError(400, 'You can review products after the order is delivered.');
  }
  const item = order.items[idx];
  if (!item) throw new ApiError(404, 'Order item not found.');

  const product = await Product.findById(item.product);
  if (!product) throw new ApiError(404, 'Product no longer exists.');

  const existing = await Review.findOne({
    user: req.user._id,
    orderItem: orderItemId,
  });
  if (existing) throw new ApiError(409, 'You already reviewed this item.');

  const review = await Review.create({
    product: item.product,
    user: req.user._id,
    orderItem: orderItemId,
    rating: rate,
    comment,
  });

  await updateProductRating(product._id);

  const populated = await Review.findById(review._id).populate('user', 'name');
  res.status(201).json({ review: populated, message: 'Thanks for your review! ⭐' });
});

/** GET /api/reviews/product/:id?page=1 — newest first, 8 per page */
exports.listProductReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid product id.');

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const filter = { product: parseId(id) };

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('user', 'name')
      .lean(),
    Review.countDocuments(filter),
  ]);

  res.json({ reviews, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
});

/** GET /api/reviews/mine — reviews I can write or already wrote, per delivered order item */
exports.myReviewables = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, status: 'delivered' }).sort({
    createdAt: -1,
  });

  const items = [];
  for (const order of orders) {
    order.items.forEach((item, idx) => {
      if (!item.product) return;
      items.push({
        orderItemId: `${order._id}:${idx}`,
        productId: item.product,
        name: item.name,
        image: item.image,
        qty: item.qty,
        orderedAt: order.createdAt,
      });
    });
  }
  if (items.length === 0) return res.json({ items: [] });

  const reviewableIds = items.map((i) => i.orderItemId);
  const existing = await Review.find({
    user: req.user._id,
    orderItem: { $in: reviewableIds },
  }).lean();
  const reviewedSet = new Set(existing.map((r) => String(r.orderItem)));

  const productIds = [...new Set(items.map((i) => String(i.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name images slug')
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const out = items
    .filter((i) => productMap.has(String(i.productId)))
    .map((i) => {
      const p = productMap.get(String(i.productId));
      return {
        orderItemId: i.orderItemId,
        product: { _id: p._id, name: p.name, images: p.images, slug: p.slug },
        name: i.name,
        image: i.image || p.images?.[0] || '',
        qty: i.qty,
        orderedAt: i.orderedAt,
        reviewed: reviewedSet.has(i.orderItemId),
      };
    });

  res.json({ items: out });
});

/** PUT /api/reviews/:id {rating, comment} — author only */
exports.updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found.');
  if (!review.user.equals(req.user._id)) throw new ApiError(403, 'Not your review.');

  const rate = Number(req.body.rating ?? review.rating);
  if (!Number.isInteger(rate) || rate < 1 || rate > 5) {
    throw new ApiError(400, 'Rating must be a whole number between 1 and 5.');
  }
  review.rating = rate;
  if (typeof req.body.comment === 'string') review.comment = req.body.comment.trim();
  await review.save();

  await updateProductRating(review.product);

  const populated = await Review.findById(review._id).populate('user', 'name');
  res.json({ review: populated, message: 'Review updated.' });
});

/** DELETE /api/reviews/:id — author or admin */
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw new ApiError(404, 'Review not found.');
  const isOwner = review.user.equals(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw new ApiError(403, 'Not allowed.');

  const productId = review.product;
  await review.deleteOne();
  await updateProductRating(productId);

  res.json({ message: 'Review deleted.' });
});

/** Recompute numReviews + averageRating on the product. */
async function updateProductRating(productId) {
  const [stats] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: '$product', num: { $sum: 1 }, avg: { $avg: '$rating' } } },
  ]);
  await Product.findByIdAndUpdate(productId, {
    numReviews: stats ? stats.num : 0,
    averageRating: stats ? Math.round(stats.avg * 10) / 10 : 0,
  });
}

exports.updateProductRating = updateProductRating;
