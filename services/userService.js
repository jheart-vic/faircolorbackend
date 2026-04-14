import User from "../models/User.js";
import Loan from "../models/Loan.js";
import Transaction from "../models/Transaction.js";
import AuditLog from "../models/AuditLog.js";
import Customer from "../models/Customer.js";
import { normalizePhone } from "../utils/normalizePhone.js";
import { formatCustomer } from "../utils/publicId.js";

export async function createCashier(payload, adminId) {
  const { fullName, email, password, phone } = payload;

  const existing = await User.findOne({ email }).select("publicId");
  if (existing) {
    throw new Error("Email already in use");
  }

if (phone) {
  const normalizedPhone = normalizePhone(phone);
  const existingPhone = await User.findOne({ phone: normalizedPhone }).select("publicId");
if (existingPhone) {
    throw new Error("Phone number already in use");
  }
}

const normalizedPhoneNumber = normalizePhone(phone);
  const cashier = await User.create({
    fullName,
    email: email.toLowerCase().trim(),
    password,
    phone: normalizedPhoneNumber,
    role: "cashier",
  });

  // Audit log
  await AuditLog.create({
    action: "CREATE_CASHIER",
    performedBy: adminId,
    targetId: cashier._id,
  });

  return {
    id: cashier._id,
    fullName: cashier.fullName,
    email: cashier.email,
    role: cashier.role,
    publicId: cashier.publicId,
    phone: cashier.phone,
  };
}

export async function getCashiers(query) {
    const {
        page = 1,
        limit = 10,
        name,
        email,
    } = query

    const filter = { role: 'cashier' }
    if (name) filter.fullName = { $regex: name, $options: 'i' }
    if (email) filter.email = { $regex: email, $options: 'i' }

    const skip = (page - 1) * limit

    const [cashiers, total] = await Promise.all([
        User.find(filter)
            .select('publicId fullName email phone createdAt')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 }),
        User.countDocuments(filter),
    ])

    const data = await Promise.all(
        cashiers.map(async (cashier) => {
            const [totalCustomers, totalTransactions, totalLoans, transactionSummary] =
                await Promise.all([
                    Customer.countDocuments({
                        $or: [
                            { createdBy: cashier._id },
                            { assignedTo: cashier._id },
                        ],
                    }),
                    Transaction.countDocuments({ cashierId: cashier._id }),
                    Loan.countDocuments({ createdBy: cashier._id }),
                    Transaction.aggregate([
                        { $match: { cashierId: cashier._id, status: 'approved' } },
                        { $group: { _id: '$type', total: { $sum: '$amount' } } },
                    ]),
                ])

            const summary = { deposits: 0, withdrawals: 0, loans: 0 }
            transactionSummary.forEach((t) => {
                if (t._id === 'deposit') summary.deposits = t.total
                if (t._id === 'withdrawal') summary.withdrawals = t.total
                if (t._id === 'loan') summary.loans = t.total
            })

            return {
                cashier: {
                    id: cashier._id,
                    publicId: cashier.publicId,
                    fullName: cashier.fullName,
                    email: cashier.email,
                    createdAt: cashier.createdAt,
                },
                stats: {
                    totalCustomers,
                    totalTransactions,
                    totalLoans,
                    ...summary,
                    netBalance: summary.deposits - summary.withdrawals - summary.loans,
                },
            }
        }),
    )

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

export async function getCashierById(cashierId, query) {
    const cashier = await User.findOne({ publicId: cashierId, role: 'cashier' })
    if (!cashier) throw new AppError('Cashier not found', 404)

    const {
        page = 1,
        limit = 10,
        startDate,
        endDate,
        transactionType, // deposit | withdrawal | loan
    } = query

    const skip = (page - 1) * limit

    const dateFilter = {}
    if (startDate) dateFilter.$gte = new Date(startDate)
    if (endDate) dateFilter.$lte = new Date(endDate)
    const hasDateFilter = Object.keys(dateFilter).length > 0

    // ── Build filters ─────────────────────────────────────────────────────────
    const customerFilter = {
        $or: [{ createdBy: cashier._id }, { assignedTo: cashier._id }],
        ...(hasDateFilter && { createdAt: dateFilter }),
    }

    const transactionFilter = {
        cashierId: cashier._id,
        ...(transactionType && { type: transactionType }),
        ...(hasDateFilter && { createdAt: dateFilter }),
    }

    const loanFilter = {
        createdBy: cashier._id,
        ...(hasDateFilter && { createdAt: dateFilter }),
    }

    // ── Paginated queries + totals in parallel ────────────────────────────────
    const [
        customers,
        totalCustomers,
        transactions,
        totalTransactions,
        loans,
        totalLoans,
        transactionSummary,
    ] = await Promise.all([
        Customer.find(customerFilter)
            .select('fullName surname otherName publicId phone status createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Customer.countDocuments(customerFilter),

        Transaction.find(transactionFilter)
            .populate('customerId', 'fullName surname otherName publicId phone')
            .select('publicId type amount status note createdAt customerId loanId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Transaction.countDocuments(transactionFilter),

        Loan.find(loanFilter)
            .populate('customerId', 'fullName surname otherName publicId phone')
            .select('publicId amount interest amountToPay monthlyPayment duration purpose repaymentMethod guarantor status createdAt customerId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Loan.countDocuments(loanFilter),

        Transaction.aggregate([
            {
                $match: {
                    cashierId: cashier._id,
                    status: 'approved',
                    ...(hasDateFilter && { createdAt: dateFilter }),
                },
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]),
    ])

    const summary = { deposits: 0, withdrawals: 0, loans: 0 }
    transactionSummary.forEach((t) => {
        if (t._id === 'deposit') summary.deposits = t.total
        if (t._id === 'withdrawal') summary.withdrawals = t.total
        if (t._id === 'loan') summary.loans = t.total
    })

    return {
        cashier: {
            id: cashier._id,
            publicId: cashier.publicId,
            fullName: cashier.fullName,
            email: cashier.email,
            createdAt: cashier.createdAt,
        },
        stats: {
            totalCustomers,
            totalTransactions,
            totalLoans,
            ...summary,
            netBalance: summary.deposits - summary.withdrawals - summary.loans,
        },
        customers: {
            data: customers,
            pagination: {
                total: totalCustomers,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(totalCustomers / limit),
            },
        },
        transactions: {
            data: transactions,
            pagination: {
                total: totalTransactions,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(totalTransactions / limit),
            },
        },
        loans: {
            data: loans,
            pagination: {
                total: totalLoans,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(totalLoans / limit),
            },
        },
    }
}

export async function transferCustomer(customerId, newCashierId, adminId) {
    const customer = await Customer.findOne({ publicId: customerId })
    if (!customer) throw new AppError('Customer not found', 404)

    const cashier = await User.findOne({ publicId: newCashierId })
    if (!cashier || cashier.role !== 'cashier') throw new AppError('Invalid cashier', 400)

    // ── Check if already assigned to this cashier ─────────────────────────────
    const currentAssignment = customer.assignedTo || customer.createdBy
    if (currentAssignment.toString() === cashier._id.toString()) {
        throw new AppError('Customer is already assigned to this cashier', 400)
    }

    const oldCashier = customer.assignedTo || customer.createdBy

    customer.assignedTo = cashier._id
    await customer.save()

    await AuditLog.create({
        action: 'TRANSFER_CUSTOMER',
        performedBy: adminId,
        targetId: customer._id,
        metadata: {
            from: oldCashier,
            to: cashier._id,
        },
    })

    const populated = await Customer.findById(customer._id)
        .populate('createdBy', 'fullName publicId')
        .populate('assignedTo', 'fullName publicId')
        .populate('approvedBy', 'fullName publicId')

    return formatCustomer(populated)
}