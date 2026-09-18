const router = require('express').Router();
const c = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

router.post('/register', c.register);
router.post('/login', c.login);
router.get('/verify/:token', c.verifyEmail);
router.post('/verify-code', c.verifyEmailCode);
router.post('/resend-verification', c.resendVerification);

router.get('/me', protect, c.me);
router.put('/me', protect, c.updateMe);
router.put('/password', protect, c.changePassword);
router.post('/license', protect, c.submitLicense);

module.exports = router;

