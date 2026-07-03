import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generatePublicId } from "../utils/publicId.js";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true, unique: true, sparse: true },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    // Roles are now data (see models/Role.js) rather than a fixed enum, so
    // Super Admins and Admins can create and assign new roles at runtime.
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    publicId: {
      type: String,
      unique: true,
      index: true,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ── Refresh token fields ──────────────────────────────
    refreshToken: {
      type: String,
      select: false,         // never returned in queries by default
    },
    refreshTokenExpiresAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// ── Hooks ─────────────────────────────────────────────────

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.pre("save", async function (next) {
  if (this.publicId || !this.role) return next();

  try {
    const Role = mongoose.model("Role");
    const role = await Role.findById(this.role).select("prefix slug");
    const prefix = role?.prefix || "STF";
    this.publicId = generatePublicId(prefix);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance methods ──────────────────────────────────────

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate a cryptographically random refresh token and persist it
userSchema.methods.generateRefreshToken = function () {
  const token = crypto.randomBytes(64).toString("hex");

  this.refreshToken = token; // store raw — hashing optional but recommended (see note)
  this.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return token;
};

// Validate an incoming refresh token against the stored one
userSchema.methods.isRefreshTokenValid = function (token) {
  return (
    this.refreshToken === token &&
    this.refreshTokenExpiresAt > new Date()
  );
};

// Revoke: called on logout or token rotation
userSchema.methods.clearRefreshToken = function () {
  this.refreshToken = undefined;
  this.refreshTokenExpiresAt = undefined;
};

// Convenience helper — checks the (populated) role's permission list.
userSchema.methods.hasPermission = function (permission) {
  const perms = this.role?.permissions || [];
  return perms.includes(permission);
};

export default mongoose.model("User", userSchema);
