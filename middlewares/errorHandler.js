export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  // Clean up any remaining raw JWT errors that slip through
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Session expired, please log in again",
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token, please log in again",
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ID format`,
    });
  }

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  // Your AppError instances
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    // only show stack in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}