import Transaction from '../models/Transaction.js'
import Customer from '../models/Customer.js'
import AuditLog from '../models/AuditLog.js'
import { getCustomerBalance } from './customerService.js'
import AppError from '../utils/appError.js'
import { formatTransaction } from '../utils/publicId.js'
import { PERMISSIONS, approvalPermissionFor, approvalTierFor } from '../utils/permissions.js'
import * as notificationService from './notificationService.js'

async function createTransaction(type, payload, user) {
    const { customerId, amount, note } = payload

    if (!customerId || !amount)
        throw new AppError('customerId and amount are required', 400)
    if (amount <= 0) throw new AppError('Amount must be greater than 0', 400)

    const customer =
        (await Customer.findOne({ publicId: customerId })) ||
        (await Customer.findById(customerId))

    if (!customer) throw new AppError('Customer not found', 404) // ← move this BEFORE using customer

    // 🔐 Ownership check — actors without a full view of transactions (e.g.
    // Cashiers) may only transact for customers created by or assigned to them.
    if (!user.hasPermission(PERMISSIONS.TRANSACTIONS_VIEW_ALL)) {
        const owns =
            customer.assignedTo?.toString() === user._id.toString() ||
            (customer.createdBy.toString() === user._id.toString() &&
                !customer.assignedTo)

        if (!owns)
            throw new AppError(
                'You are not authorized to transact for this customer',
                403,
            )
    }

    if (customer.status !== 'approved')
        throw new AppError('Customer not approved', 400)

    if (type === 'withdrawal') {
        const balanceData = await getCustomerBalance(customer._id)
        if (amount > balanceData.balance)
            throw new AppError('Insufficient balance', 400)
    }

    const transaction = await Transaction.create({
        type,
        amount,
        customerId: customer._id,
        cashierId: user._id, // ← extract from user
        note,
        status: 'pending',
    })

    await AuditLog.create({
        action: `CREATE_${type.toUpperCase()}`,
        performedBy: user._id, // ← extract from user
        targetId: transaction._id,
    })

    const approvalPermission = approvalPermissionFor(amount, 'transactions')
    await notificationService.notifyByPermission(
        approvalPermission,
        {
            type: 'transaction.pending_approval',
            title: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} pending approval`,
            message: `${user.fullName} submitted a ${type} of ₦${amount.toLocaleString()} for ${customer.fullName} — ${approvalTierFor(amount) === 'tier2' ? 'requires Super Admin approval' : 'requires Admin approval'}.`,
            meta: { amount, type, customerId: customer.publicId },
            relatedId: transaction._id,
        },
    )

    const populated = await Transaction.findById(transaction._id)
        .populate('customerId', 'fullName publicId')
        .populate('cashierId', 'fullName publicId')

    return formatTransaction(populated)
}

export async function createDeposit(payload, user) {
    return createTransaction('deposit', payload, user)
}

export async function createWithdrawal(payload, user) {
    return createTransaction('withdrawal', payload, user)
}

export async function getTransactions(query, user) {
    const { page = 1, limit = 10, type, status, startDate, endDate } = query

    const filter = {}

    // 🔐 ROLE-BASED ACCESS
    if (!user.hasPermission(PERMISSIONS.TRANSACTIONS_VIEW_ALL)) {
        const assignedCustomers = await Customer.find({
            $or: [
                { assignedTo: user._id },
                { createdBy: user._id, assignedTo: null }, // ← change $exists to null
            ],
        }).select('_id')

        const customerIds = assignedCustomers.map((c) => c._id)

        filter.customerId = { $in: customerIds }
    }
    if (type) filter.type = type
    if (status) filter.status = status

    if (startDate || endDate) {
        filter.createdAt = {}
        if (startDate) filter.createdAt.$gte = new Date(startDate)
        if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
        Transaction.find(filter)
            .populate('customerId', 'fullName surname otherName publicId phone')
            .populate('cashierId', 'fullName email publicId phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Transaction.countDocuments(filter),
    ])

    return {
        data,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit),
        },
    }
}

export async function approveTransaction(transactionId, approver) {
    const transaction = await Transaction.findOne({ publicId: transactionId })

    if (!transaction) throw new AppError('Transaction not found', 404)

    if (transaction.status !== 'pending') {
        throw new AppError('Transaction already processed', 400)
    }

    // Admin approves up to ₦200,000; Super Admin approves everything above it.
    const requiredPermission = approvalPermissionFor(transaction.amount, 'transactions')
    if (!approver.hasPermission(requiredPermission)) {
        throw new AppError(
            requiredPermission === PERMISSIONS.TRANSACTIONS_APPROVE_TIER2
                ? 'Only a Super Admin can approve transactions above ₦200,000'
                : 'You are not authorized to approve this transaction',
            403,
        )
    }

    transaction.status = 'approved'
    transaction.approvedBy = approver._id

    await transaction.save()

    await AuditLog.create({
        action: 'APPROVE_TRANSACTION',
        performedBy: approver._id,
        targetId: transaction._id,
    })

    await notificationService.notifyUsers([transaction.cashierId], {
        type: 'transaction.approved',
        title: 'Transaction approved',
        message: `Your ${transaction.type} of ₦${transaction.amount.toLocaleString()} (${transaction.publicId}) was approved by ${approver.fullName}.`,
        meta: { amount: transaction.amount, type: transaction.type },
        relatedId: transaction._id,
    })

    const populated = await Transaction.findById(transaction._id)
        .populate('customerId', 'fullName publicId')
        .populate('cashierId', 'fullName publicId')

    return formatTransaction(populated)
}

export async function rejectTransaction(transactionId, adminId) {
    const transaction = await Transaction.findOne({ publicId: transactionId })

    if (!transaction) throw new AppError('Transaction not found', 404)

    if (transaction.status !== 'pending') {
        throw new AppError('Transaction already processed', 400)
    }

    transaction.status = 'rejected'
    transaction.rejectedBy = adminId

    await transaction.save()

    await AuditLog.create({
        action: 'REJECT_TRANSACTION',
        performedBy: adminId,
        targetId: transaction._id,
    })

    await notificationService.notifyUsers([transaction.cashierId], {
        type: 'transaction.rejected',
        title: 'Transaction rejected',
        message: `Your ${transaction.type} of ₦${transaction.amount.toLocaleString()} (${transaction.publicId}) was rejected.`,
        meta: { amount: transaction.amount, type: transaction.type },
        relatedId: transaction._id,
    })

    return transaction
}
