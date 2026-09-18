const Product = require('../models/Product');
const { ApiError, asyncHandler, escapeRegex } = require('../utils/helpers');

const SORTS = {
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  name: { name: 1 },
};

/** GET /api/products — public catalog (approved only) with search/filter/sort/pagination */
exports.listProducts = asyncHandler(async (req, res) => {
  const { q, category, brand, sort = 'newest', featured, limit } = req.query;
  const pageRaw = parseInt(req.query.page, 10);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limitRaw = parseInt(limit, 10);
  const perPage = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 12;

  const filter = { status: 'approved' };
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i');
    filter.$or = [{ name: rx }, { brand: rx }, { description: rx }];
  }
  if (category) filter.category = category;
  if (brand) filter.brand = new RegExp(`^${escapeRegex(String(brand))}$`, 'i');
  if (featured === 'true') filter.featured = true;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .select('-hotspots')
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({
    products,
    count: products.length,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / perPage)),
  });
});

/** GET /api/products/meta — categories + distinct brands for filter UI */
exports.getMeta = asyncHandler(async (req, res) => {
  const brands = (await Product.distinct('brand', { status: 'approved' })).sort();
  res.json({ categories: Product.CATEGORIES, brands });
});

/** GET /api/products/:id — public detail; owner/admin may preview non-approved docs */
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('seller', 'shopName name');
  if (!product) throw new ApiError(404, 'Product not found.');

  if (product.status !== 'approved') {
    const sellerId = product.seller?._id || product.seller;
    const isOwner = req.user && req.user._id.equals(sellerId);
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isOwner && !isAdmin) throw new ApiError(404, 'Product not found.');
  }

  res.json({ product });
});
