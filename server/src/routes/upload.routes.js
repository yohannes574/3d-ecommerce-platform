const router = require('express').Router();
const { uploadFile, uploadLicense, uploadPaymentProof } = require('../controllers/upload.controller');
const { protect, requireApprovedSeller } = require('../middleware/auth');

// sellers (approved) and admins may upload images / .glb models
router.post('/', protect, requireApprovedSeller, uploadFile);

// license upload is allowed for ANY logged-in user: it happens during seller
// registration, before an approved seller account exists. Registration itself
// is done with a temporary customer token (see auth.controller.register).
router.post('/license', protect, uploadLicense);

// payment receipt screenshots — any logged-in customer can attach proof of payment
router.post('/payment', protect, uploadPaymentProof);

module.exports = router;
