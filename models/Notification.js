import mongoose from 'mongoose'

const NOTIFICATION_TYPES = [
    'customer.pending_approval',
    'customer.approved',
    'transaction.pending_approval',
    'transaction.approved',
    'transaction.rejected',
    'loan.pending_review',
    'loan.recommended',
    'loan.pending_approval',
    'loan.approved',
    'loan.rejected',
    'role.assigned',
]

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: NOTIFICATION_TYPES,
            required: true,
        },
        title: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true },
        // Loosely-typed extra context (amount, publicId of the related record, etc.)
        meta: { type: Object, default: {} },
        // The record this notification is about (transaction, loan, customer, user)
        relatedId: { type: mongoose.Schema.Types.ObjectId },
        isRead: { type: Boolean, default: false, index: true },
        readAt: { type: Date },
    },
    { timestamps: true },
)

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })

export { NOTIFICATION_TYPES }
export default mongoose.model('Notification', notificationSchema)