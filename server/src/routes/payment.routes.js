const router = require('express').Router();
const c = require('../controllers/payment.controller');
const { protect, requireRole } = require('../middleware/auth');

/* public capability probe — tells the SPA whether Chapa is in electronic mode */
router.get('/config', c.paymentConfig);

/* customer opens / re-opens the hosted checkout for their own order */
router.post('/chapa/init', protect, requireRole('customer'), c.chapaInit);

/* Chapa redirects the customer's browser here after checkout (no auth — it's a redirect) */
router.get('/chapa/callback', c.chapaCallback);

/* Chapa servers push settlement events here (public; every payload is re-verified via API) */
router.post('/chapa/webhook', c.chapaWebhook);

module.exports = router;
