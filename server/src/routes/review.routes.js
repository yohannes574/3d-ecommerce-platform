const router = require('express').Router();
const c = require('../controllers/review.controller');
const { protect } = require('../middleware/auth');

// public
router.get('/product/:id', c.listProductReviews);

// authenticated
router.get('/mine', protect, c.myReviewables);
router.post('/', protect, c.createReview);
router.put('/:id', protect, c.updateReview);
router.delete('/:id', protect, c.deleteReview);

module.exports = router;
