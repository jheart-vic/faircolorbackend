import mongoose from 'mongoose'

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

        amount: {
            type: Number,
            required: true,
            min: 1,
        },

        interest: {
            type: Number,
            required: true, // e.g. 5 (%)
        },

        duration: {
            type: Number,
            required: true, // months
        },

        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    { timestamps: true },
)

loanSchema.pre('save', function (next) {
    if (!this.publicId) {
        this.publicId = generatePublicId('LOAN')
    }
    next()
})

export default mongoose.model('Loan', loanSchema)
