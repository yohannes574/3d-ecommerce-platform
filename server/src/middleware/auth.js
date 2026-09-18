const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../utils/helpers');

function getToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

/* Hard auth — 401 when missing/invalid token */
const protect = asyncHandler(async (req, res, next) => {
  const token = getToken(req);
  if (!token) throw new ApiError(401, 'Not authenticated. Please log in.');

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'voltix-dev-secret');
  } catch (err) {
    throw new ApiError(401, 'Session expired or invalid. Please log in again.');
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user) throw new ApiError(401, 'Account no longer exists.');

  req.user = user;
  next();
});

/* Soft auth — attaches req.user when a valid token exists, never fails */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = getToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'voltix-dev-secret');
    req.user = await User.findById(decoded.id).select('-password');
  } catch (err) {
    /* ignore invalid tokens for public routes */
  }
  next();
});

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to do that.'));
    }
    next();
  };

/* Sellers must be approved by an admin before managing products/uploads.
   Admins pass through for convenience. */
const requireApprovedSeller = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'seller' && req.user.status === 'approved') return next();
  return next(
    new ApiError(403, 'Your seller account has not been approved yet.')
  );
};

module.exports = { protect, optionalAuth, requireRole, requireApprovedSeller };
