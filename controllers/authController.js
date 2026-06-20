import * as authService from "../services/authService.js";
import {
  setRefreshCookie,
  clearRefreshCookie,
  setAccessCookie,
} from "../utils/token.js";

// ── Login ─────────────────────────────
export async function login(req, res, next) {
  try {
    const data = await authService.loginUser(req.body);

    setRefreshCookie(res, data.refreshToken);
    setAccessCookie(res, data.accessToken);

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: data.user, // user info is safe to return; only the token moves to the cookie
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

    const data = await authService.refreshTokenService(token);

    setRefreshCookie(res, data.refreshToken);
    setAccessCookie(res, data.accessToken);

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

    await authService.logoutService(token);

    clearRefreshCookie(res);
    clearAccessCookie(res);

    res.status(200).json({
      success: true,
      message: "Logged out",
    });
  } catch (err) {
    next(err);
  }
}