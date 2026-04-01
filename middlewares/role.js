export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new Error("Forbidden"));
    }
    next();
  };
}