import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "loan"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
publicId: {
  type: String,
  unique: true,
  index: true,
  required: true,
},

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    note: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

transactionSchema.pre("save", function (next) {
  if (!this.publicId) {
    this.publicId = generatePublicId("TRX");
  }
  next();
});

// Index for fast dashboard queries
transactionSchema.index({ customerId: 1, status: 1, type: 1, createdAt: 1 });

export default mongoose.model("Transaction", transactionSchema);