const { ApiError } = require('../utils/helpers');

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('. ');
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue || {}).join(', ')}`;
  } else if (typeof err.code === 'string' && err.code.startsWith('LIMIT_')) {
    status = 400; // multer upload errors
    message = 'File too large or invalid upload.';
  }

  if (status >= 500) console.error('✖ Error:', err);

  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler, ApiError };
