import jwt from "jsonwebtoken";

export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}


export function signAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

// Cookie options reused everywhere
export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" ? true : false,
  sameSite:
    process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

export function setRefreshCookie(res, token) {
  res.cookie("refreshToken", token, refreshCookieOptions);
}

export function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    ...refreshCookieOptions,
    maxAge: 0,
  });
}