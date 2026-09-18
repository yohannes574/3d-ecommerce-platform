const router = require('express').Router();
const c = require('../controllers/order.controller');
const { protect, requireRole, requireApprovedSeller } = require('../middleware/auth');

/* middleware stacks (no blanket router.use — roles differ per route) */
const customerOnly = [protect, requireRole('customer')];
const adminOnly = [protect, requireRole('admin')];

/* customer */
router.post('/', ...customerOnly, c.placeOrder);
router.get('/mine', ...customerOnly, c.myOrders);
router.patch('/:id/cancel', ...customerOnly, c.cancelOrder);

/* seller: orders containing this seller's products */
router.get('/seller', protect, requireApprovedSeller, c.sellerOrders);
router.patch('/:id/confirm', protect, requireApprovedSeller, c.sellerConfirmOrder);
router.patch('/:id/reject-payment', protect, requireApprovedSeller, c.sellerRejectPayment);

/* admin: full order pipeline */
router.get('/', ...adminOnly, c.listOrders);
router.patch('/:id/status', ...adminOnly, c.setOrderStatus);

module.exports = router;
