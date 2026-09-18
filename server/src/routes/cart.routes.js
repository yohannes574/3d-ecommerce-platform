const router = require('express').Router();
const c = require('../controllers/cart.controller');
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('customer', 'admin'));

router.get('/', c.getCart);
router.post('/', c.addItem);
router.patch('/:itemId', c.updateItem);
router.delete('/:itemId', c.removeItem);

module.exports = router;
