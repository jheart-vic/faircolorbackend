import User from "../models/User.js";
import AppError from "../utils/appError.js";
import {
  signAccessToken,
} from "../utils/token.js";

// ── Login ─────────────────────────────────────────────────

export async function loginUser(payload) {
  const { email, password } = payload;

  const user = await User.findOne({ email })
    .select("+password +refreshToken +refreshTokenExpiresAt")
    .populate("role", "name slug permissions");

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
      role: {
        id: user.role._id,
        name: user.role.name,
        slug: user.role.slug,
        permissions: user.role.permissions,
      },
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

  await User.updateOne(
    { refreshToken: token },
    { $unset: { refreshToken: "", refreshTokenExpiresAt: "" } }
  );
}