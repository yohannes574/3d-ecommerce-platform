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

/* ---------- static uploads dir ---------- */

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOAD_DIR));

/* ---------- CORS ---------- */

const origins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
  'https://voltix-frontend.onrender.com',
];

console.log('✅ Allowed CORS origins:', origins);

app.use(
  cors({
    origin: origins,
  })
);

/* ---------- global middleware ---------- */

app.use(express.json({ limit: '2mb' }));

app.use(helmetMiddleware);

/* ---------- rate limits ---------- */

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

/* ---------- 404 + errors ---------- */

app.use(notFound);

app.use(errorHandler);

/* ---------- boot ---------- */

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  require('./utils/notify').verifyMailer();

  app.listen(PORT, () => {
    console.log(
      `🚀 Voltix API running on http://localhost:${PORT}`
    );
  });
})();