const router = require('express').Router();
const c = require('../controllers/product.controller');
const { optionalAuth } = require('../middleware/auth');

router.get('/', c.listProducts);
router.get('/meta', c.getMeta);
router.get('/:id', optionalAuth, c.getProduct);

module.exports = router;
