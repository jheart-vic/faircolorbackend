import mongoose from 'mongoose'
import { generatePublicId } from "../utils/publicId.js";

const guarantorSchema = new mongoose.Schema({
    fullName: { type: String, trim: true },
    maritalStatus: { type: String, enum: ['single', 'married', 'divorced', 'widowed'] },
    dateOfBirth: { type: Date },
    state: { type: String },
    address: { type: String },
    landmark: { type: String },
    lga: { type: String },
    phone: { type: String },
    email: { type: String },
    relationship: { type: String },
    country: { type: String, default: 'Nigeria' },
}, { _id: false })

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
        // kept for backwards compat / display convenience
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
        meansOfIdentification: { type: String }, // e.g. NIN slip, Voter's card, etc.

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

        // ── Guarantor (from loan form) ────────────────────────────────────────
        guarantor: { type: guarantorSchema },

        // ── Meta ──────────────────────────────────────────────────────────────
        isDeactivated: { type: Boolean, default: false },
        isApproved: { type: Boolean, default: false },
        deactivatedAt: { type: Date },
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
    { timestamps: true },
)

customerSchema.pre('validate', function (next) {
    if (!this.publicId) {
        this.publicId = generatePublicId('CUS')
    }
    // Auto-derive fullName from surname + otherName
    if (!this.fullName && this.surname) {
        this.fullName = [this.surname, this.otherName].filter(Boolean).join(' ')
    }
    next()
})

customerSchema.pre(/^find/, function (next) {
    this.where({ isDeactivated: false })
    next()
})

customerSchema.pre('remove', async function (next) {
    try {
        await Transaction.deleteMany({ customerId: this._id })
        await Loan.deleteMany({ customerId: this._id })
        await AuditLog.deleteMany({ targetId: this._id })
        next()
    } catch (err) {
        next(err)
    }
})

export default mongoose.model('Customer', customerSchema)