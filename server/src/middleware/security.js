const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

/* Secure HTTP headers (CSP disabled — the SPA is API-only; enable per your hosting) */
const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads images cross-origin
});

/* General API: generous but bounded */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests — slow down.' },
});

/* Uploads: small burst allowance */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many uploads — wait a minute.' },
});

module.exports = { helmetMiddleware, apiLimiter, uploadLimiter };
