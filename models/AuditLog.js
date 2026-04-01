import mongoose from "mongoose";

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    meta: {
      type: Object,
    },
  },
  { timestamps: true }
);

export default mongoose.model("AuditLog", auditSchema);