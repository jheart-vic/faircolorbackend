import jwt from "jsonwebtoken";
import User from "../models/User.js";
import AppError from "../utils/appError.js";

export async function protect(req, res, next) {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Not authorized, no token", 401));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new AppError("Session expired, please log in again", 401));
      }
      if (err.name === "JsonWebTokenError") {
        return next(new AppError("Invalid token, please log in again", 401));
      }
      return next(new AppError("Authentication failed", 401));
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