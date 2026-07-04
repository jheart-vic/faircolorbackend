import mongoose from 'mongoose'
import { ALL_PERMISSIONS } from '../utils/permissions.js'

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Short uppercase prefix used when generating a staff member's publicId
    // for this role, e.g. "ADM", "ACM". Falls back to the first 4 letters of
    // the slug if not provided.
    prefix: {
      type: String,
      trim: true,
      uppercase: true,
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (perms) => perms.every((p) => ALL_PERMISSIONS.includes(p)),
        message: 'One or more permissions are not recognized',
      },
    },
    // The four MVP-defined roles (Super Admin, Admin, Account Manager,
    // Cashier). They cannot be deleted, and only a Super Admin can edit
    // their permission set — this keeps the baseline access model stable
    // even though Admins can otherwise create and manage roles freely.
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
)

roleSchema.pre('validate', function (next) {
  if (!this.prefix) {
    this.prefix = this.slug.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'STF'
  }
  next()
})

export default mongoose.model('Role', roleSchema)