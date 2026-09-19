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

/* =========================================================
   Static uploads directory
========================================================= */

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOAD_DIR));

/* =========================================================
   CORS
========================================================= */

// Temporarily allow the requesting origin.
// This is useful for testing the production CORS problem.
app.use(
  cors({
    origin: true,
  })
);

/* =========================================================
   Global middleware
========================================================= */

app.use(express.json({ limit: '2mb' }));

app.use(helmetMiddleware);

/* =========================================================
   Rate limiting
========================================================= */

app.use('/api/upload', uploadLimiter);

app.use('/api', apiLimiter);

/* =========================================================
   Health check
========================================================= */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: 'voltix-api',
    time: new Date().toISOString(),
  });
});

/* =========================================================
   API routes
========================================================= */

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

/* =========================================================
   404 + Error handling
========================================================= */

app.use(notFound);

app.use(errorHandler);

/* =========================================================
   Server startup
========================================================= */

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