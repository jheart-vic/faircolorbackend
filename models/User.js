// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";
// import { generatePublicId } from "../utils/publicId.js";

// const ROLE_PREFIX = {
//   cashier: "CASH",
//   staff: "STF",
//   manager: "MGR",
// };

// const userSchema = new mongoose.Schema(
//     {
//         fullName: {
//             type: String,
//             required: true,
//             trim: true,
//         },

//         email: {
//             type: String,
//             required: true,
//             unique: true,
//             lowercase: true,
//             trim: true,
//         },
//        phone:{ type: String, trim: true, unique:true },

//         password: {
//             type: String,
//             required: true,
//             minlength: 6,
//             select: false,
//         },

//         role: {
//             type: String,
//             enum: ['admin', 'cashier'],
//             default: 'cashier',
//         },
//         publicId: {
//             type: String,
//             unique: true,
//             index: true,
//             required: false,
//         },
//         isActive: {
//             type: Boolean,
//             default: true,
//         },
//     refreshToken: {
//       type: String,
//       select: false,         // never returned in queries by default
//     },
//     refreshTokenExpiresAt: {
//       type: Date,
//       select: false,
//     },
//   },
//     { timestamps: true },
// )

// // Hash password before save
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// userSchema.pre("save", function (next) {
//   if (!this.publicId && this.role !== "admin") {
//     const prefix = ROLE_PREFIX[this.role]
//     this.publicId = generatePublicId(prefix);
//   }
//   next();
// });

// // Compare password
// userSchema.methods.comparePassword = async function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// export default mongoose.model("User", userSchema);

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generatePublicId } from "../utils/publicId.js";

const ROLE_PREFIX = {
  cashier: "CASH",
  staff: "STF",
  manager: "MGR",
};

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
    phone: { type: String, trim: true, unique: true },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "cashier"],
      default: "cashier",
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

userSchema.pre("save", function (next) {
  if (!this.publicId && this.role !== "admin") {
    const prefix = ROLE_PREFIX[this.role];
    this.publicId = generatePublicId(prefix);
  }
  next();
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

export default mongoose.model("User", userSchema);