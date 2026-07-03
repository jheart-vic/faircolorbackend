import Loan from '../models/Loan.js'
import Customer from '../models/Customer.js'
import AuditLog from '../models/AuditLog.js'
import Transaction from '../models/Transaction.js'
import AppError from '../utils/appError.js'
import mongoose from 'mongoose'
import { PERMISSIONS, approvalPermissionFor, approvalTierFor } from '../utils/permissions.js'
import * as notificationService from './notificationService.js'

const INTEREST_RATES = {
    1: 12,
    2: 20,
    3: 25,
    4: 30,
    6: 35,
    12: 75,
}

export async function createLoan(payload, user) {
    const { customerId, duration, purpose, repaymentMethod, guarantor } =
        payload
    const amount = Number(payload.amount)

    if (isNaN(amount) || amount <= 0) {
        throw new AppError(
            'Amount must be a valid number greater than zero',
            400,
        )
    }

    if (!customerId || !amount || !duration) {
        throw new AppError('All fields are required', 400)
    }

    if (amount <= 0) {
        throw new AppError('Amount must be greater than zero', 400)
    }

    const VALID_REPAYMENT_METHODS = ['monthly', 'weekly', 'daily', 'quarterly']
    if (repaymentMethod && !VALID_REPAYMENT_METHODS.includes(repaymentMethod)) {
        throw new AppError(
            `Invalid repayment method. Allowed: ${VALID_REPAYMENT_METHODS.join(', ')}`,
            400,
        )
    }

    const interestRate = INTEREST_RATES[duration]
    if (!interestRate) {
        throw new AppError(
            `Invalid duration. Allowed durations: ${Object.keys(INTEREST_RATES).join(', ')} month(s)`,
            400,
        )
    }

    const customer = user.hasPermission(PERMISSIONS.CUSTOMERS_VIEW_ALL)
        ? await Customer.findOne({ publicId: customerId })
        : await Customer.findOne({
              publicId: customerId,
              $or: [{ createdBy: user._id }, { assignedTo: user._id }],
          })
    if (!customer)
        throw new AppError('Customer not found or not assigned to you', 404)
    if (customer.status !== 'approved')
        throw new AppError('Customer not approved', 400)

    const amountToPay = Math.ceil(amount + (amount * interestRate) / 100)
    const monthlyPayment = Math.ceil(amountToPay / duration)

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const [loan] = await Loan.create(
            [
                {
                    customerId: customer._id,
                    amount,
                    interest: interestRate,
                    duration,
                    amountToPay,
                    monthlyPayment,
                    purpose,
                    repaymentMethod,
                    guarantor,
                    createdBy: user._id,
                    status: 'pending',
                },
            ],
            { session },
        )

        await AuditLog.create(
            [
                {
                    action: 'CREATE_LOAN',
                    performedBy: user._id,
                    targetId: loan._id,
                },
            ],
            { session },
        )

        await session.commitTransaction()

        // Fire notifications after the transaction commits — not critical
        // enough to roll back loan creation if this fails.
        await notificationService.notifyByPermission(PERMISSIONS.LOANS_REVIEW, {
            type: 'loan.pending_review',
            title: 'Loan application awaiting review',
            message: `${user.fullName} submitted a ₦${amount.toLocaleString()} loan application for ${customer.fullName}.`,
            meta: { amount, customerId: customer.publicId },
            relatedId: loan._id,
        })
        await notificationService.notifyByPermission(
            approvalPermissionFor(amount, 'loans'),
            {
                type: 'loan.pending_approval',
                title: 'Loan pending approval',
                message: `A ₦${amount.toLocaleString()} loan for ${customer.fullName} needs ${approvalTierFor(amount) === 'tier2' ? 'Super Admin' : 'Admin'} approval.`,
                meta: { amount, customerId: customer.publicId },
                relatedId: loan._id,
            },
        )

        return Loan.findById(loan._id)
            .populate('customerId', 'fullName publicId phone address')
            .populate('createdBy', 'fullName publicId')
            .select(
                'publicId amount interest amountToPay monthlyPayment duration purpose repaymentMethod guarantor status createdAt customerId createdBy',
            )
    } catch (err) {
        await session.abortTransaction()
        throw err
    } finally {
        session.endSession()
    }
}

// Account Manager review step — recommends (or declines to recommend) a
// pending loan before it goes to an Admin/Super Admin for the final decision.
// Purely advisory: it doesn't change the loan's status, just attaches a
// recommendation so approvers have the Account Manager's input.
export async function recommendLoan(loanId, payload, reviewer) {
    const { recommendation, note } = payload
    const VALID = ['recommended', 'not_recommended']
    if (!VALID.includes(recommendation)) {
        throw new AppError(`recommendation must be one of: ${VALID.join(', ')}`, 400)
    }

    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (loan.status !== 'pending') {
        throw new AppError('Only pending loans can be reviewed', 400)
    }

    loan.recommendedBy = reviewer._id
    loan.recommendation = recommendation
    loan.recommendationNote = note
    loan.recommendedAt = new Date()
    await loan.save()

    await AuditLog.create({
        action: 'RECOMMEND_LOAN',
        performedBy: reviewer._id,
        targetId: loan._id,
        meta: { recommendation },
    })

    await notificationService.notifyByPermission(
        approvalPermissionFor(loan.amount, 'loans'),
        {
            type: 'loan.recommended',
            title: recommendation === 'recommended' ? 'Loan recommended for approval' : 'Loan reviewed — not recommended',
            message: `${reviewer.fullName} ${recommendation === 'recommended' ? 'recommended' : 'did not recommend'} loan ${loan.publicId} (₦${loan.amount.toLocaleString()}).`,
            meta: { recommendation, amount: loan.amount },
            relatedId: loan._id,
        },
    )

    return Loan.findById(loan._id)
        .populate('customerId', 'fullName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .populate('recommendedBy', 'fullName publicId')
        .select(
            'publicId amount interest amountToPay monthlyPayment duration purpose status recommendation recommendationNote recommendedBy recommendedAt createdAt customerId createdBy',
        )
}

export async function approveLoan(loanId, approver) {
    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (loan.status !== 'pending') {
        throw new AppError('Loan already processed', 400)
    }

    // Admin approves up to ₦200,000; Super Admin approves everything above it.
    const requiredPermission = approvalPermissionFor(loan.amount, 'loans')
    if (!approver.hasPermission(requiredPermission)) {
        throw new AppError(
            requiredPermission === PERMISSIONS.LOANS_APPROVE_TIER2
                ? 'Only a Super Admin can approve loans above ₦200,000'
                : 'You are not authorized to approve this loan',
            403,
        )
    }

    const adminId = approver._id

    loan.status = 'approved'
    loan.approvedBy = adminId
    await loan.save()

    const transaction = await Transaction.create({
        type: 'loan',
        amount: loan.amount,
        customerId: loan.customerId,
        cashierId: loan.createdBy,
        approvedBy: adminId,
        status: 'approved',
        note: `Loan disbursed for (${loan.publicId})`,
        loanId: loan._id,
    })

    await AuditLog.create({
        action: 'APPROVE_LOAN',
        performedBy: adminId,
        targetId: loan._id,
    })

    await notificationService.notifyUsers(
        [loan.createdBy, loan.recommendedBy].filter(Boolean),
        {
            type: 'loan.approved',
            title: 'Loan approved',
            message: `Loan ${loan.publicId} for ₦${loan.amount.toLocaleString()} was approved and disbursed by ${approver.fullName}.`,
            meta: { amount: loan.amount },
            relatedId: loan._id,
        },
    )

    // Return populated loan and transaction
    const populatedLoan = await Loan.findById(loan._id)
        .populate('customerId', 'fullName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .populate('approvedBy', 'fullName publicId')
        .populate('recommendedBy', 'fullName publicId')
        .select(
            'publicId amount interest  amountToPay monthlyPayment duration status createdAt customerId createdBy approvedBy recommendation recommendedBy',
        )

    const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('customerId', 'fullName surname otherName publicId phone')
        .populate('cashierId', 'fullName publicId')
        .populate('approvedBy', 'fullName publicId')
        .populate('loanId', 'guarantor publicId')
        .select(
            'publicId type amount status note createdAt customerId cashierId approvedBy loanId',
        )

    return { loan: populatedLoan, transaction: populatedTransaction }
}

export async function getLoans(query) {
    const {
        page = 1,
        limit = 10,
        status,
        customerId,
        startDate,
        endDate,
    } = query

    // Base filter (NO status) — the stat cards span every status.
    const baseFilter = {}

    if (customerId) {
        const customer = await Customer.findOne({ publicId: customerId })
        if (customer) baseFilter.customerId = customer._id
    }

    if (startDate || endDate) {
        baseFilter.createdAt = {}
        if (startDate) baseFilter.createdAt.$gte = new Date(startDate)
        if (endDate) baseFilter.createdAt.$lte = new Date(endDate)
    }

    // List filter = base + status (status narrows only the table).
    const listFilter = { ...baseFilter, ...(status ? { status } : {}) }

    const skip = (page - 1) * limit

    const [data, total, statsAgg] = await Promise.all([
        Loan.find(listFilter)
            .populate(
                'customerId',
                'fullName surname otherName phone publicId address',
            )
            .populate('createdBy', 'fullName publicId')
            .populate('approvedBy', 'fullName publicId')
            .populate('rejectedBy', 'fullName publicId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Loan.countDocuments(listFilter),

        // One pass: counts + amounts grouped by status, across ALL statuses.
        Loan.aggregate([
            // { $match: baseFilter },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' },
                },
            },
        ]),
    ])

    // Shape the stats for the cards.
    const stats = {
        total: 0,
        totalAmount: 0,
        byStatus: {
            pending: 0,
            approved: 0,
            rejected: 0,
            disbursed: 0,
            completed: 0,
        },
    }
    for (const s of statsAgg) {
        stats.total += s.count
        stats.totalAmount += s.amount
        if (s._id in stats.byStatus) stats.byStatus[s._id] = s.count
    }

    return {
        data,
        stats,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit),
        },
    }
}

export async function rejectLoan(loanId, adminId) {
    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (loan.status !== 'pending') {
        throw new AppError('Loan already processed', 400)
    }

    loan.status = 'rejected'
    loan.rejectedBy = adminId
    await loan.save()

    await AuditLog.create({
        action: 'REJECT_LOAN',
        performedBy: adminId,
        targetId: loan._id,
    })

    await notificationService.notifyUsers(
        [loan.createdBy, loan.recommendedBy].filter(Boolean),
        {
            type: 'loan.rejected',
            title: 'Loan rejected',
            message: `Loan ${loan.publicId} for ₦${loan.amount.toLocaleString()} was rejected.`,
            meta: { amount: loan.amount },
            relatedId: loan._id,
        },
    )

    const populatedLoan = await Loan.findById(loan._id)
        .populate(
            'customerId',
            'fullName surname otherName publicId phone address',
        )
        .populate('createdBy', 'fullName publicId')
        .populate('rejectedBy', 'fullName publicId')
        .select(
            'publicId amount interest duration purpose repaymentMethod status createdAt customerId createdBy rejectedBy',
        )

    return { loan: populatedLoan }
}

// Super Admin only — undoes an approve/reject decision, sending the loan
// back to 'pending' for a fresh review. If the loan had been approved (and
// therefore disbursed), the disbursement transaction is marked 'reverted'
// rather than deleted, so it drops out of balance calculations while still
// being visible in the audit trail.
export async function revertLoanToPending(loanId, actor) {
    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (!['approved', 'rejected'].includes(loan.status)) {
        throw new AppError('Only approved or rejected loans can be reverted', 400)
    }

    const wasApproved = loan.status === 'approved'

    if (wasApproved) {
        await Transaction.updateMany(
            { loanId: loan._id, type: 'loan', status: 'approved' },
            { $set: { status: 'reverted' } },
        )
    }

    loan.status = 'pending'
    loan.approvedBy = undefined
    loan.rejectedBy = undefined
    await loan.save()

    await AuditLog.create({
        action: 'REVERT_LOAN',
        performedBy: actor._id,
        targetId: loan._id,
        meta: { wasApproved },
    })

    await notificationService.notifyUsers(
        [loan.createdBy, loan.recommendedBy].filter(Boolean),
        {
            type: 'loan.pending_review',
            title: 'Loan reverted to pending',
            message: `${actor.fullName} reverted loan ${loan.publicId} (₦${loan.amount.toLocaleString()}) back to pending review.`,
            meta: { amount: loan.amount },
            relatedId: loan._id,
        },
    )

    return Loan.findById(loan._id)
        .populate('customerId', 'fullName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .populate('recommendedBy', 'fullName publicId')
        .select(
            'publicId amount interest amountToPay monthlyPayment duration purpose status recommendation recommendedBy createdAt customerId createdBy',
        )
}

export async function updateCreditAnalysis(loanId, payload, adminId) {
    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (loan.status === 'rejected') {
        throw new AppError(
            'Cannot update credit analysis on a rejected loan',
            400,
        )
    }

    const {
        guarantyFund,
        upfrontCharges,
        expectedInterest,
        totalIncomeExpected,
        repaymentPlan,
        accountOfficer,
        headBusinessDevelopment,
        hopFincon,
        internalControl,
        accountNo,
    } = payload

    loan.creditAnalysis = {
        guarantyFund,
        upfrontCharges,
        expectedInterest,
        totalIncomeExpected,
        repaymentPlan,
        accountOfficer,
        headBusinessDevelopment,
        hopFincon,
        internalControl,
        accountNo,
    }

    await loan.save()

    await AuditLog.create({
        action: 'UPDATE_CREDIT_ANALYSIS',
        performedBy: adminId,
        targetId: loan._id,
    })

    return Loan.findById(loan._id)
        .populate('customerId', 'fullName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .populate('approvedBy', 'fullName publicId')
        .select(
            'publicId amount interest amountToPay monthlyPayment duration purpose repaymentMethod status creditAnalysis createdAt customerId createdBy approvedBy',
        )
}
