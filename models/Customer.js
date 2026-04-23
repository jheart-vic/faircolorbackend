import mongoose from 'mongoose'
import { generatePublicId } from '../utils/publicId.js'
import Transaction from './Transaction.js'
import Loan from './Loan.js'
import AuditLog from './AuditLog.js'

const customerSchema = new mongoose.Schema(
    {
        publicId: {
            type: String,
            unique: true,
            index: true,
            required: true,
        },

        // ── Identity ──────────────────────────────────────────────────────────
        title: {
            type: String,
            enum: ['Mr', 'Mrs', 'Miss', 'Dr', 'Prof'],
        },
        surname: {
            type: String,
            required: true,
            trim: true,
        },
        otherName: {
            type: String,
            trim: true,
        },
        fullName: {
            type: String,
            trim: true,
        },
        gender: {
            type: String,
            enum: ['male', 'female'],
        },
        maritalStatus: {
            type: String,
            enum: ['single', 'married', 'divorced', 'widowed'],
        },
        dateOfBirth: { type: Date },
        nationality: { type: String, default: 'Nigerian' },
        bvn: { type: String, trim: true },
        nin: { type: String, trim: true },
        meansOfIdentification: { type: String },

        // ── Contact ───────────────────────────────────────────────────────────
        phone: {
            type: String,
            required: false,
            unique: true,
            index: true,
        },
        email: { type: String, trim: true },
        address: {
            type: String,
            required: true,
        },
        businessAddress: { type: String },

        // ── Employment ────────────────────────────────────────────────────────
        occupation: { type: String },
        employerName: { type: String },
        employerAddress: { type: String },

        // ── Bank details ──────────────────────────────────────────────────────
        bankName: { type: String },
        accountName: { type: String },
        accountNumber: { type: String },

        // ── Next of kin ───────────────────────────────────────────────────────
        nextOfKin: {
            fullName: { type: String },
            address: { type: String },
            phone: { type: String },
        },
        emergencyContact: {
            fullName: { type: String },
            phone: { type: String },
            address: { type: String },
        },

        // ── Meta ──────────────────────────────────────────────────────────────
        isDeactivated: { type: Boolean, default: false },
        deactivatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        isApproved: { type: Boolean, default: false },
        deactivatedAt: { type: Date, default: null },
        status: {
            type: String,
            enum: ['pending', 'approved'],
            default: 'pending',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            index: true,
            default: null,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {timestamps: true,  toJSON: { virtuals: true }, toObject: { virtuals: true }}
)
customerSchema.pre('validate', function (next) {
    if (!this.publicId) {
        this.publicId = generatePublicId('CUS')
    }
    if (!this.fullName && this.surname) {
        this.fullName = [this.surname, this.otherName].filter(Boolean).join(' ')
    }
    next()
})
customerSchema.virtual('accountStatus').get(function () {
  return this.isDeactivated ? 'deactivated' : 'active'
})
customerSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      await Transaction.deleteMany({ customerId: this._id });
      await Loan.deleteMany({ customerId: this._id });
      await AuditLog.deleteMany({ targetId: this._id });
      next();
    } catch (err) {
      next(err);
    }
  }
);


export default mongoose.model('Customer', customerSchema)
