import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/appError.js";

export async function protect(req, res, next) {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization?.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!token) {
      return next(new AppError("Not authorized, no token", 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === "TokenExpiredError"
          ? "Session expired, please log in again"
          : err.name === "JsonWebTokenError"
          ? "Invalid token, please log in again"
          : "Authentication failed";
      return next(new AppError(message, 401));
    }

    const user = await User.findById(decoded.id);
    if (!user) return next(new AppError("User no longer exists", 404));
    if (!user.isActive) return next(new AppError("Account is deactivated", 403));

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}