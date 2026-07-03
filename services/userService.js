import User from '../models/User.js'
import Role from '../models/Role.js'
import Loan from '../models/Loan.js'
import Transaction from '../models/Transaction.js'
import AuditLog from '../models/AuditLog.js'
import Customer from '../models/Customer.js'
import { normalizePhone } from '../utils/normalizePhone.js'
import { formatCustomer } from '../utils/publicId.js'
import AppError from '../utils/appError.js'
import { PERMISSIONS } from '../utils/permissions.js'

// A role can be "own" (own scoped customers) if it holds either of these.
const OWNERSHIP_PERMISSIONS = [
    PERMISSIONS.CUSTOMERS_VIEW_OWN,
    PERMISSIONS.CUSTOMERS_MANAGE,
]

async function resolveRole(roleIdOrSlug) {
    if (!roleIdOrSlug) throw new AppError('role is required', 400)
    const role =
        (await Role.findById(roleIdOrSlug).catch(() => null)) ||
        (await Role.findOne({ slug: roleIdOrSlug }))
    if (!role) throw new AppError('Role not found', 404)
    return role
}

// Admins can create Account Managers and Cashiers (and any custom role that
// doesn't exceed their own permissions); only a Super Admin can create
// another Admin or Super Admin.
function assertCanAssignRoleToNewStaff(actor, targetRole) {
    if (actor.hasPermission(PERMISSIONS.USERS_MANAGE_ALL)) return // Super Admin

    if (['admin', 'super_admin'].includes(targetRole.slug)) {
        throw new AppError('Only a Super Admin can create an Admin or Super Admin account', 403)
    }

    const actorPermissions = actor.role.permissions || []
    const overreach = (targetRole.permissions || []).filter(
        (p) => !actorPermissions.includes(p),
    )
    if (overreach.length) {
        throw new AppError(
            `You cannot assign a role with permissions you don't have: ${overreach.join(', ')}`,
            403,
        )
    }
}

export async function createStaff(payload, actor) {
    const { fullName, email, password, phone, role } = payload

    const targetRole = await resolveRole(role)
    assertCanAssignRoleToNewStaff(actor, targetRole)

    const existing = await User.findOne({ email }).select('publicId')
    if (existing) {
        throw new AppError('Email already in use', 400)
    }

    let normalizedPhoneNumber
    if (phone) {
        normalizedPhoneNumber = normalizePhone(phone)
        const existingPhone = await User.findOne({
            phone: normalizedPhoneNumber,
        }).select('publicId')
        if (existingPhone) {
            throw new AppError('Phone number already in use', 400)
        }
    }

    const staff = await User.create({
        fullName,
        email: email.toLowerCase().trim(),
        password,
        phone: normalizedPhoneNumber,
        role: targetRole._id,
        createdBy: actor._id,
    })

    await AuditLog.create({
        action: 'CREATE_STAFF',
        performedBy: actor._id,
        targetId: staff._id,
        meta: { role: targetRole.slug },
    })

    return {
        id: staff._id,
        fullName: staff.fullName,
        email: staff.email,
        role: { id: targetRole._id, name: targetRole.name, slug: targetRole.slug },
        publicId: staff.publicId,
        phone: staff.phone,
    }
}

export async function getStaff(query) {
    const { page = 1, limit = 10, name, email, role } = query

    const filter = {}
    if (name) filter.fullName = { $regex: name, $options: 'i' }
    if (email) filter.email = { $regex: email, $options: 'i' }

    if (role) {
        const roleDoc = await resolveRole(role)
        filter.role = roleDoc._id
    } else {
        // Default staff listing excludes Super Admin accounts from the
        // general roster — they're managed separately for safety.
        const superAdmin = await Role.findOne({ slug: 'super_admin' })
        if (superAdmin) filter.role = { $ne: superAdmin._id }
    }

    const skip = (page - 1) * limit

    const [staffMembers, total] = await Promise.all([
        User.find(filter)
            .select('publicId fullName email phone role createdAt')
            .populate('role', 'name slug')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 }),
        User.countDocuments(filter),
    ])

    const data = await Promise.all(
        staffMembers.map(async (staff) => {
            const [
                totalCustomers,
                totalTransactions,
                totalLoans,
                transactionSummary,
            ] = await Promise.all([
                Customer.countDocuments({
                    $or: [
                        { createdBy: staff._id },
                        { assignedTo: staff._id },
                    ],
                }),
                Transaction.countDocuments({ cashierId: staff._id }),
                Loan.countDocuments({ createdBy: staff._id }),
                Transaction.aggregate([
                    { $match: { cashierId: staff._id, status: 'approved' } },
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
                staff: {
                    id: staff._id,
                    publicId: staff.publicId,
                    fullName: staff.fullName,
                    email: staff.email,
                    role: staff.role,
                    createdAt: staff.createdAt,
                    phone: staff.phone,
                },
                stats: {
                    totalCustomers,
                    totalTransactions,
                    totalLoans,
                    ...summary,
                    netBalance:
                        summary.deposits - summary.withdrawals - summary.loans,
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

export async function getStaffById(staffId, query) {
    const staff = await User.findOne({ publicId: staffId }).populate('role', 'name slug')
    if (!staff) throw new AppError('Staff member not found', 404)

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
        $or: [{ createdBy: staff._id }, { assignedTo: staff._id }],
        ...(hasDateFilter && { createdAt: dateFilter }),
    }

    const transactionFilter = {
        cashierId: staff._id,
        ...(transactionType && { type: transactionType }),
        ...(hasDateFilter && { createdAt: dateFilter }),
    }

    const loanFilter = {
        createdBy: staff._id,
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
            .select(
                'fullName surname otherName publicId phone status createdAt',
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Customer.countDocuments(customerFilter),

        Transaction.find(transactionFilter)
            .populate('customerId', 'fullName surname otherName publicId phone')
            .select(
                'publicId type amount status note createdAt customerId loanId',
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Transaction.countDocuments(transactionFilter),

        Loan.find(loanFilter)
            .populate('customerId', 'fullName surname otherName publicId phone')
            .select(
                'publicId amount interest amountToPay monthlyPayment duration purpose repaymentMethod guarantor status createdAt customerId',
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Loan.countDocuments(loanFilter),

        Transaction.aggregate([
            {
                $match: {
                    cashierId: staff._id,
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
        staff: {
            id: staff._id,
            publicId: staff.publicId,
            fullName: staff.fullName,
            email: staff.email,
            role: staff.role,
            createdAt: staff.createdAt,
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

export async function transferCustomer(customerId, newStaffId, adminId) {
    const customer = await Customer.findOne({ publicId: customerId })
    if (!customer) throw new AppError('Customer not found', 404)

    const staff = await User.findOne({ publicId: newStaffId }).populate('role', 'permissions slug')
    if (!staff) throw new AppError('Staff member not found', 400)

    const canOwnCustomers = OWNERSHIP_PERMISSIONS.some((p) =>
        staff.role?.permissions?.includes(p),
    )
    if (!canOwnCustomers) {
        throw new AppError('That staff member\'s role cannot be assigned customers', 400)
    }

    // ── Check if already assigned to this staff member ─────────────────────────
    const currentAssignment = customer.assignedTo || customer.createdBy
    if (currentAssignment.toString() === staff._id.toString()) {
        throw new AppError('Customer is already assigned to this staff member', 400)
    }

    const oldStaff = customer.assignedTo || customer.createdBy

    customer.assignedTo = staff._id
    await customer.save()

    await AuditLog.create({
        action: 'TRANSFER_CUSTOMER',
        performedBy: adminId,
        targetId: customer._id,
        meta: {
            from: oldStaff,
            to: staff._id,
        },
    })

    const populated = await Customer.findById(customer._id)
        .populate('createdBy', 'fullName publicId')
        .populate('assignedTo', 'fullName publicId')
        .populate('approvedBy', 'fullName publicId')

    return formatCustomer(populated)
}

export async function deleteStaff(staffId, actor) {
    const staff = await User.findOne({ publicId: staffId }).populate('role', 'permissions slug name')
    if (!staff) throw new AppError('Staff member not found', 404)

    if (staff.role.slug === 'super_admin') {
        const superAdmin = await Role.findOne({ slug: 'super_admin' })
        const remaining = await User.countDocuments({ role: superAdmin._id })
        if (remaining <= 1) {
            throw new AppError('Cannot delete the last remaining Super Admin', 400)
        }
        if (actor.role.slug !== 'super_admin') {
            throw new AppError('Only a Super Admin can delete a Super Admin account', 403)
        }
    }

    // ── Check if staff member still has customers ──────────────────────────────
    const customerCount = await Customer.countDocuments({
        $or: [
            { createdBy: staff._id },
            { assignedTo: staff._id },
        ],
    })

    if (customerCount > 0) {
        throw new AppError(
            `Staff member still has ${customerCount} customer(s). Transfer them before deleting.`,
            400
        )
    }

    await User.findByIdAndDelete(staff._id)

    await AuditLog.create({
        action: 'DELETE_STAFF',
        performedBy: actor._id,
        targetId: staff._id,
        meta: {
            deletedStaff: staff.publicId,
            fullName: staff.fullName,
            role: staff.role.slug,
        },
    })
}
