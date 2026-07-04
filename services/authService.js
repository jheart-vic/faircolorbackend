import User from "../models/User.js";
import AppError from "../utils/appError.js";
import {
  signAccessToken,
} from "../utils/token.js";

// ── Login ─────────────────────────────────────────────────

export async function loginUser(payload) {
  const { email, password } = payload;

  let user;
  try {
    user = await User.findOne({ email })
      .select("+password +refreshToken +refreshTokenExpiresAt")
      .populate("role", "name slug permissions");
  } catch (err) {
    // A user record still holding the pre-migration string role (e.g.
    // "admin") instead of a Role reference will fail here. Surface a clear,
    // actionable message instead of leaking the raw Mongoose cast error.
    if (err.name === "CastError" && err.path === "role") {
      throw new AppError(
        "This account has an outdated role configuration and needs to be migrated by a Super Admin before it can log in.",
        409
      );
    }
    throw err;
  }

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.isActive) {
    throw new AppError("Account is deactivated", 403);
  }

  if (!user.role) {
    throw new AppError(
      "This account has no role assigned. Contact a Super Admin.",
      403
    );
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