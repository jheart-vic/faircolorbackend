import mongoose from 'mongoose'
import { generatePublicId } from '../utils/publicId.js'

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
        amountToPay: {
            type: Number,
        },
        monthlyPayment: {
        type: Number,
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

loanSchema.pre('validate', function (next) {
  if (!this.publicId) {
    this.publicId = generatePublicId('LOAN');
  }
  if (this.amount && this.interest && !this.amountToPay) {
    this.amountToPay = Math.round(this.amount + (this.amount * this.interest / 100));
  }
  if (this.amountToPay && this.duration && !this.monthlyPayment) {
    this.monthlyPayment = Math.round(this.amountToPay / this.duration);
  }
  next();
})

export default mongoose.model('Loan', loanSchema)
