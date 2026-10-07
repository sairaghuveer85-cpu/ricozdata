/**
 * Higher-order utility to wrap async Express route handlers and forward rejected promises to error middleware.
 *
 * @param {Function} fn - Async express route handler (req, res, next)
 * @returns {Function} Express route handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default asyncHandler;
