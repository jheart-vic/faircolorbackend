import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },


        phone: {
            type: String,
            required: true,
            unique: true,
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

customerSchema.pre('save', function (next) {
    if (!this.publicId) {
        this.publicId = generatePublicId('CUS')
    }
    next()
})

export default mongoose.model('Customer', customerSchema)
