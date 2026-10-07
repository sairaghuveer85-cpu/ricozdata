/**
 * Centralized 404 handler for routes that do not match any defined endpoint.
 * Emits the standardized enterprise error envelope.
 */
export function notFoundHandler(req, res, next) {
  const message = `Resource not found: ${req.method} ${req.originalUrl}`;
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message,
      details: {}
    },
    meta: {},
    message
  });
}

export default notFoundHandler;
