import mongoose from 'mongoose'
import { generatePublicId } from "../utils/publicId.js";

const customerSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        isDeactivated: { type: Boolean, default: false },
        deactivatedAt: { type: Date },

        phone: {
            type: String,
            required: false,
            unique: true,
            index: true,
        },

        address: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            enum: ['pending', 'approved'],
            default: 'pending',
        },

        publicId: {
            type: String,
            unique: true,
            index: true,
            required: true,
            // default: () => generatePublicId('CUS'),
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
          default:null
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
    next()
})

// Automatically filter out deactivated customers in find queries
customerSchema.pre(/^find/, function (next) {
    this.where({ isDeactivated: false })
    next()
})

 customerSchema.pre('remove', async function (next) {
    try {
        const customerId = this._id

        // Delete all transactions
        await Transaction.deleteMany({ customerId })

        // Delete all loans
        await Loan.deleteMany({ customerId })

        // Delete audit logs targeting this customer
        await AuditLog.deleteMany({ targetId: customerId })

        next()
    } catch (err) {
        next(err)
    }
})

export default mongoose.model('Customer', customerSchema)
