import mongoose from 'mongoose'
import { generatePublicId } from '../utils/publicId.js'

// Credit analysis filled by the credit unit (official use section of the form)
const creditAnalysisSchema = new mongoose.Schema({
    guarantyFund: { type: Number },
    upfrontCharges: { type: Number },
    expectedInterest: { type: Number },
    totalIncomeExpected: { type: Number },
    repaymentPlan: { type: String },
    accountOfficer: { type: String },
    headBusinessDevelopment: { type: String },
    hopFincon: { type: String },
    internalControl: { type: String },
    accountNo: { type: String },
}, { _id: false })

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

// A single repayment installment — lives inside the loan it belongs to.
const repaymentSchema = new mongoose.Schema({
    date: { type: Date },
    amount: { type: Number, required: true, min: 1 },
    balance: { type: Number }, // running balance after this payment (from the ledger)
}, { _id: false })

const loanSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        publicId: {
            type: String,
            unique: true,
            index: true,
            required: true,
        },

        // ── Loan details (from form) ───────────────────────────────────────────
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        amountToPay: { type: Number },
        monthlyPayment: { type: Number },
        interest: {
            type: Number,
            required: true, // e.g. 5 (%)
        },
        duration: {
            type: Number,
            required: true, // months = tenor
        },
        purpose: { type: String }, // "Purpose of the Loan" on the form
        repaymentMethod: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'quarterly'],
            default: 'monthly',
        },

        // ── Disbursement details (from the transfers sheet) ────────────────────
        disbursementDate: { type: Date },
        maturityDate: { type: Date },
        interestAmount: { type: Number }, // interest in naira (distinct from interest %)
        deposit: { type: Number },        // upfront deposit / collateral
        formInsurance: { type: Number },

        // ── Repayments (embedded — a loan owns its repayment schedule) ─────────
        repayments: { type: [repaymentSchema], default: [] },
        totalRepaid: { type: Number, default: 0 }, // sum of repayment amounts

        // ── Status ────────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'disbursed', 'completed'],
            default: 'pending',
        },
        // ── Guarantor  ────────────────────────────────────────
        guarantor: { type: guarantorSchema },
        // ── Official use (credit unit section) ───────────────────────────────
        creditAnalysis: { type: creditAnalysisSchema },

        // ── Actors ────────────────────────────────────────────────────────────
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },

        // ── Import metadata (migration bookkeeping; ignore in app logic) ───────
        _import: {
            source: { type: String },             // e.g. "LOAN REPAYMENT sheet"
            ref: { type: String, index: true },    // idempotency key for re-runs
            note: { type: String },                // review flags, if any
        },
    },
    { timestamps: true },
)

loanSchema.pre('validate', function (next) {
    if (!this.publicId) {
        this.publicId = generatePublicId('LOAN')
    }
    if (this.amount && this.interest && !this.amountToPay) {
        this.amountToPay = Math.round(this.amount + (this.amount * this.interest / 100))
    }
    if (this.amountToPay && this.duration && !this.monthlyPayment) {
        this.monthlyPayment = Math.round(this.amountToPay / this.duration)
    }
    next()
})

export default mongoose.model('Loan', loanSchema)