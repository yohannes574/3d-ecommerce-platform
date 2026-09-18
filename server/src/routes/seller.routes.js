const router = require('express').Router();
const c = require('../controllers/seller.controller');
const orderController = require('../controllers/order.controller');
const { protect, requireApprovedSeller } = require('../middleware/auth');

router.use(protect, requireApprovedSeller);

router.get('/stats', c.myStats);
router.get('/orders', orderController.sellerOrders);

router.get('/products', c.myProducts);
router.post('/products', c.createProduct);
router.get('/products/:id', c.getMyProduct);
router.put('/products/:id', c.updateProduct);
router.delete('/products/:id', c.deleteProduct);

module.exports = router;
