require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');

const {
  notFound,
  errorHandler,
} = require('./middleware/errorHandler');

const {
  helmetMiddleware,
  apiLimiter,
  uploadLimiter,
} = require('./middleware/security');

const app = express();

/* ---------- Static uploads directory ---------- */

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOAD_DIR));

/* ---------- CORS ---------- */

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'https://voltix-frontend.onrender.com',
];

console.log('✅ Allowed CORS origins:', allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header
      // such as direct server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        console.log(`✅ CORS allowed: ${origin}`);
        return callback(null, true);
      }

      console.log(`❌ CORS blocked: ${origin}`);
      return callback(null, false);
    },
  })
);

/* ---------- Global middleware ---------- */

app.use(express.json({ limit: '2mb' }));

app.use(helmetMiddleware);

/* ---------- Rate limits ---------- */

app.use('/api/upload', uploadLimiter);

app.use('/api', apiLimiter);

/* ---------- API routes ---------- */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'voltix-api',
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/auth.routes'));

app.use('/api/products', require('./routes/product.routes'));

app.use('/api/seller', require('./routes/seller.routes'));

app.use('/api/admin', require('./routes/admin.routes'));

app.use('/api/cart', require('./routes/cart.routes'));

app.use('/api/orders', require('./routes/order.routes'));

app.use('/api/reviews', require('./routes/review.routes'));

app.use('/api/notifications', require('./routes/notification.routes'));

app.use('/api/upload', require('./routes/upload.routes'));

app.use('/api/payments', require('./routes/payment.routes'));

/* ---------- 404 + Error handling ---------- */

app.use(notFound);

app.use(errorHandler);

/* ---------- Server boot ---------- */

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();

    require('./utils/notify').verifyMailer();

    app.listen(PORT, () => {
      console.log(
        `🚀 Voltix API running on http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
})();