const router = require('express').Router();
const c = require('../controllers/admin.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('admin'));

router.get('/stats', c.platformStats);

router.get('/sellers', c.listSellers);
router.get('/audit', require('../utils/audit').listAudit);
router.patch('/sellers/:id/status', c.setSellerStatus);

router.get('/products', c.listProducts);
router.patch('/products/:id/status', c.setProductStatus);
router.patch('/products/:id/featured', c.setFeatured);

module.exports = router;
