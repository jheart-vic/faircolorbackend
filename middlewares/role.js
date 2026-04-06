import AppError from "../utils/appError.js";

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Access Forbidden and Denied", 403));
    }
    next();
  };
}