const Product = require('../models/Product');
const Order = require('../models/Order');
const { ApiError, asyncHandler } = require('../utils/helpers');

/** Fields a seller is allowed to set on create/update */
function pickProductFields(body) {
  const out = {};
  ['name', 'brand', 'category', 'description', 'price', 'compareAtPrice', 'stock',
   'images', 'specs', 'variants', 'model3dUrl', 'hotspots'].forEach((f) => {
    if (body[f] !== undefined) out[f] = body[f];
  });

  /* Normalize variant options: { value, priceDelta, stock? } — option stock is
     optional (null = inherit the product-level counter). */
  if (Array.isArray(out.variants)) {
    out.variants = out.variants.map((g) => ({
      name: String(g.name || '').trim(),
      values: (Array.isArray(g.values) ? g.values : []).map((o) => {
        const norm = {
          value: String(o?.value ?? o ?? '').trim(),
          priceDelta: Number(o?.priceDelta) || 0,
        };
        const s = o?.stock;
        if (s !== null && s !== undefined && s !== '') {
          const n = Number(s);
          if (Number.isFinite(n) && n >= 0) norm.stock = Math.floor(n);
        }
        /* Explicit swatch color: store only strict #rrggbb values. */
        const sw = String(o?.swatch || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(sw)) norm.swatch = sw;
        return norm;
      }),
    }));
  }
  return out;
}

/** GET /api/seller/stats — dashboard analytics for the logged-in seller */
exports.myStats = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;

  const [productCount, approvedCount, pendingCount, draftCount, revenueAgg,
    topAgg, recentOrders] = await Promise.all([
    Product.countDocuments({ seller: sellerId }),
    Product.countDocuments({ seller: sellerId, status: 'approved' }),
    Product.countDocuments({ seller: sellerId, status: 'pending' }),
    Product.countDocuments({ seller: sellerId, status: 'draft' }),
    Order.aggregate([
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $match: { 'prod.seller': sellerId, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.qty'] } },
                  units: { $sum: '$items.qty' }, orders: { $addToSet: '$_id' } } },
      { $project: { revenue: 1, units: 1, orderCount: { $size: '$orders' } } },
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'prod' } },
      { $unwind: '$prod' },
      { $match: { 'prod.seller': sellerId, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$items.product', name: { $first: '$items.name' },
                  units: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.qty'] } } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
      { $project: { _id: 1, name: 1, units: 1, revenue: 1 } },
    ]),
    Order.find({ 'items.product': { $in: await Product.find({ seller: sellerId }).distinct('_id') } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('status total createdAt items.name items.qty items.unitPrice'),
  ]);

  res.json({
    stats: {
      products: productCount,
      approved: approvedCount,
      pending: pendingCount,
      drafts: draftCount,
      revenue: revenueAgg[0]?.revenue || 0,
      unitsSold: revenueAgg[0]?.units || 0,
      orders: revenueAgg[0]?.orderCount || 0,
      topProducts: topAgg,
      recentOrders,
    },
  });
});

/** GET /api/seller/products — own products, any status */
exports.myProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).sort({ updatedAt: -1 });
  res.json({ products });
});

/** GET /api/seller/products/:id — own product for editing */
exports.getMyProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ product });
});

/** POST /api/seller/products */
exports.createProduct = asyncHandler(async (req, res) => {
  const data = pickProductFields(req.body);
  if (!data.name || !data.brand || data.price === undefined) {
    throw new ApiError(400, 'Name, brand and price are required.');
  }

  // status: sellers may save drafts or submit for approval — nothing goes live directly
  const status = req.body.status === 'draft' ? 'draft' : 'pending';

  const product = await Product.create({
    ...data,
    seller: req.user._id,
    status,
    featured: false,
  });

  res.status(201).json({
    product,
    message:
      status === 'draft'
        ? 'Draft saved.'
        : 'Submitted! Your product is pending admin approval.',
  });
});

/** PUT /api/seller/products/:id */
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, seller: req.user._id });
  if (!product) throw new ApiError(404, 'Product not found.');

  Object.assign(product, pickProductFields(req.body));
  if (req.body.status === 'draft') product.status = 'draft';
  else if (req.body.status === 'pending') product.status = 'pending';
  // otherwise keep the current status; admins control approval/featured

  await product.save();
  res.json({ product, message: 'Product updated.' });
});

/** DELETE /api/seller/products/:id */
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({ _id: req.params.id, seller: req.user._id });
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ message: 'Product deleted.' });
});
