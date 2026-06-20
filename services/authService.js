import User from "../models/User.js";
import AppError from "../utils/appError.js";
import {
  signAccessToken,
} from "../utils/token.js";

// ── Login ─────────────────────────────────────────────────

export async function loginUser(payload) {
  const { email, password } = payload;

  const user = await User.findOne({ email }).select(
    "+password +refreshToken +refreshTokenExpiresAt"
  );

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Account is deactivated", 403);
  }

  const accessToken = signAccessToken(user._id);
  const refreshToken = user.generateRefreshToken();
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      publicId: user.publicId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  };
}

// ── Refresh ───────────────────────────────────────────────
export async function refreshTokenService(token) {
  if (!token) throw new AppError("No refresh token", 401);

  const user = await User.findOne({ refreshToken: token }).select(
    "+refreshToken +refreshTokenExpiresAt"
  );

  if (!user || !user.isRefreshTokenValid(token)) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const accessToken = signAccessToken(user._id);
  const newRefreshToken = user.generateRefreshToken();

  await user.save();

  return { accessToken, refreshToken: newRefreshToken };
}

// ── Logout ───────────────────────────────────────────────
export async function logoutService(token) {
  if (!token) return;

  const user = await User.findOne({ refreshToken: token }).select(
    "+refreshToken +refreshTokenExpiresAt"
  );

  if (user) {
    user.refreshToken = undefined;
    user.refreshTokenExpiresAt = undefined;
    await user.save();
  }
}