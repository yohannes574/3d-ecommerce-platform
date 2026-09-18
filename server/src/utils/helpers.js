/** Small shared utilities for the API layer. */

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Wraps async route handlers so thrown errors/rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Escapes user input used inside RegExp queries. */
const escapeRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { ApiError, asyncHandler, escapeRegex };
