const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { ApiError, asyncHandler } = require('../utils/helpers');
const { notify } = require('../utils/notify');
const { logAudit } = require('../utils/audit');

/* ---------------- Platform stats ---------------- */

/** GET /api/admin/stats — headline numbers for the admin console */
exports.platformStats = asyncHandler(async (req, res) => {
  const [users, sellers, pendingSellers, products, pendingProducts, orders, revenueAgg] =
    await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'seller' }),
      User.countDocuments({ role: 'seller', status: 'pending' }),
      Product.countDocuments(),
      Product.countDocuments({ status: 'pending' }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

  res.json({
    stats: {
      customers: users,
      sellers,
      pendingSellers,
      products,
      pendingProducts,
      orders,
      revenue: revenueAgg[0]?.total || 0,
    },
  });
});

/* ---------------- Sellers ---------------- */

/** GET /api/admin/sellers?status=pending */
exports.listSellers = asyncHandler(async (req, res) => {
  const filter = { role: 'seller' };
  if (req.query.status) filter.status = req.query.status;
  const sellers = await User.find(filter).sort({ createdAt: -1 });
  res.json({ sellers });
});

/** PATCH /api/admin/sellers/:id/status {status:'approved'|'rejected'|'pending'} */
exports.setSellerStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new ApiError(400, "status must be 'approved', 'rejected' or 'pending'.");
  }
  const seller = await User.findById(req.params.id);
  if (!seller || seller.role !== 'seller') throw new ApiError(404, 'Seller not found.');

  /* Hard rule: no approval without a verified-on-file business license. */
  if (status === 'approved' && !seller.licenseUrl) {
    throw new ApiError(400, 'License document required before approval.');
  }

  seller.status = status;
  await seller.save();

  logAudit(req, 'seller.status', { target: `User:${seller._id}`, meta: { status, email: seller.email } });
  await notify({
    userId: seller._id,
    email: seller.email,
    type: 'seller',
    title: status === 'approved' ? 'Your store is approved! 🎉' : status === 'rejected' ? 'Your seller application was rejected' : 'Your store is back under review',
    body: status === 'approved'
      ? 'You can now log in to the Seller Hub and start listing products.'
      : status === 'rejected'
        ? 'Log in to view your status and re-submit an updated business license.'
        : 'Your license was re-opened for review. We will notify you once decided.',
    link: '/seller',
  });

  res.json({ seller, message: `Seller ${status}.` });
});

/* ---------------- Products ---------------- */

/** GET /api/admin/products?status=pending */
exports.listProducts = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const products = await Product.find(filter)
    .populate('seller', 'shopName name')
    .sort({ createdAt: -1 });
  res.json({ products });
});

/** PATCH /api/admin/products/:id/status {status:'approved'|'rejected'|'pending'} */
exports.setProductStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new ApiError(400, "status must be 'approved', 'rejected' or 'pending'.");
  }
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );
  if (!product) throw new ApiError(404, 'Product not found.');

  logAudit(req, 'product.status', { target: `Product:${product._id}`, meta: { status, name: product.name } });
  await notify({
    userId: product.seller,
    type: 'product',
    title: status === 'approved' ? `"${product.name}" is live ✅` : status === 'rejected' ? `"${product.name}" was rejected` : `"${product.name}" is back in review`,
    body: status === 'approved'
      ? 'Your product passed review and is now visible in the storefront.'
      : status === 'rejected'
        ? 'Your product was not approved. You can edit and resubmit it from the Seller Hub.'
        : 'Your product was re-opened for admin review.',
    link: '/seller',
  });

  res.json({ product, message: `Product ${status}.` });
});

/** PATCH /api/admin/products/:id/featured {featured:boolean} */
exports.setFeatured = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { featured: !!req.body.featured },
    { new: true }
  );
  if (!product) throw new ApiError(404, 'Product not found.');
  res.json({ product, message: product.featured ? 'Marked as featured.' : 'Removed from featured.' });
});
