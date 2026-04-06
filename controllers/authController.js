import * as authService from "../services/authService.js";
import {
  setRefreshCookie,
  clearRefreshCookie,
} from "../utils/token.js";

// ── Login ─────────────────────────────
export async function login(req, res, next) {
  try {
    const data = await authService.loginUser(req.body);

    setRefreshCookie(res, data.refreshToken);

    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken: data.accessToken,
      user: data.user,
    });
  } catch (err) {
    next(err);
  }
}

// ── Refresh ───────────────────────────
export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

    const data = await authService.refreshTokenService(token);

    setRefreshCookie(res, data.refreshToken);
    res.status(200).json({
      success: true,
      accessToken: data.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ── Logout ────────────────────────────
export async function logout(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;

    await authService.logoutService(token);

    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      message: "Logged out",
    });
  } catch (err) {
    next(err);
  }
}