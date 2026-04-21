import Customer from "../models/Customer.js";
import AuditLog from "../models/AuditLog.js";
import { normalizePhone } from "../utils/normalizePhone.js";
import Transaction from "../models/Transaction.js";
import { formatCustomer } from "../utils/publicId.js";
import AppError from "../utils/appError.js";

// export async function createCustomer(payload, userId) {
//   const { fullName, phone, address } = payload;

//   const normalizedPhone = normalizePhone(phone);

//   const existing = await Customer.findOne({ phone: normalizedPhone });
//   if (existing) {
//     throw new AppError("Customer with this phone already exists", 400);
//   }

//   const customer = await Customer.create({
//     fullName,
//     phone: normalizedPhone,
//     address,
//     createdBy: userId,
//     status: "pending",
//   });

//   await customer.populate({ path: "createdBy", select: "fullName email" });
//   // Audit log
//   await AuditLog.create({
//     action: "CREATE_CUSTOMER",
//     performedBy: userId,
//     targetId: customer._id,
//   });

//   return formatCustomer(customer);
// }

export async function createCustomer(payload, userId) {
    const {
        title, surname, otherName, gender, maritalStatus,
        dateOfBirth, nationality, bvn, nin, meansOfIdentification,
        phone, email, address, businessAddress,
        occupation, employerName, employerAddress,
        bankName, accountName, accountNumber,
        nextOfKin, emergencyContact,
    } = payload

    const normalizedPhone = normalizePhone(phone)

    const existing = await Customer.findOne({ phone: normalizedPhone })
    if (existing) {
        throw new AppError('Customer with this phone already exists', 400)
    }

    const customer = await Customer.create({
        title, surname, otherName, gender, maritalStatus,
        dateOfBirth, nationality, bvn, nin, meansOfIdentification,
        phone: normalizedPhone, email, address, businessAddress,
        occupation, employerName, employerAddress,
        bankName, accountName, accountNumber,
        nextOfKin, emergencyContact,
        createdBy: userId,
        isApproved:false,
        status: 'pending',
    })

    await customer.populate({ path: 'createdBy', select: 'fullName email' })

    await AuditLog.create({
        action: 'CREATE_CUSTOMER',
        performedBy: userId,
        targetId: customer._id,
    })

    return formatCustomer(customer)
}

export async function getCustomers(query, user) {
    const {
        page = 1,
        limit = 10,
        search,
        phone,
        status, // 👈 add this
    } = query

    const filter = {}

    // 🔐 Role-based filtering
    if (user.role === 'cashier') {
        filter.$or = [
            { createdBy: user._id },
            { assignedTo: user._id },
        ]
    }

    // ✅ Status filtering (clean & explicit)
    if (status === 'active') {
        filter.isDeactivated = false
    } else if (status === 'deactivated') {
        filter.isDeactivated = true
    }
    // 👉 if no status → return ALL (both active + deactivated)

    // 🔍 Search
    if (search) {
        filter.$and = filter.$and || []
        filter.$and.push({
            $or: [
                { fullName: { $regex: search, $options: 'i' } },
                { surname: { $regex: search, $options: 'i' } },
                { otherName: { $regex: search, $options: 'i' } },
            ],
        })
    }

    // 📞 Phone filter
    if (phone) {
        filter.$and = filter.$and || []
        filter.$and.push({ phone: { $regex: phone } })
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [data, total] = await Promise.all([
        Customer.find(filter)
            .populate('createdBy', 'fullName publicId')
            .populate('assignedTo', 'fullName publicId')
            .populate('approvedBy', 'fullName publicId')
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 }),

        Customer.countDocuments(filter),
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

export async function approveCustomer(customerId, adminId) {
  const customer = await Customer.findOne({ publicId: customerId });

  if (!customer) throw new AppError("Customer not found", 404);

  if (customer.status === "approved") {
    throw new AppError("Customer already approved", 400);
  }

  customer.status = "approved";
  customer.isApproved= true
  customer.approvedBy = adminId;

  await customer.save();

  await AuditLog.create({
    action: "APPROVE_CUSTOMER",
    performedBy: adminId,
    targetId: customer._id,
  });

  return customer;
}

export async function getCustomerBalance(customerId) {
  const result = await Transaction.aggregate([
    {
      $match: {
        customerId,
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]);

  let deposits = 0;
  let withdrawals = 0;
  let loans = 0;

  result.forEach((r) => {
    if (r._id === "deposit") deposits = r.total;
    if (r._id === "withdrawal") withdrawals = r.total;
    if (r._id === "loan") loans = r.total;
  });

  const balance = deposits - withdrawals - loans;

  return {
    deposits,
    withdrawals,
    loans,
    balance,
  };
}

export async function getCustomerBalanceByPublicId(customerId, user) {
  const customer = await Customer.findOne({ publicId: customerId });

  if (!customer) throw new AppError("Customer not found", 404);

  // 🔐 ACCESS CONTROL
  if (user.role === "cashier") {
    const isOwner =
      customer.createdBy.toString() === user._id.toString() ||
      (customer.assignedTo &&
        customer.assignedTo.toString() === user._id.toString());

    if (!isOwner) {
      throw new AppError("Not authorized to view this customer's balance", 403);
    }
  }

  return getCustomerBalance(customer._id);
}

export async function deleteCustomer(customerId, user) {
  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new AppError("Customer not found", 404);

  // Only admin
  if (user.role !== "admin") {
    throw new AppError("Not authorized to delete this customer", 403);
  }

  // This triggers the pre('remove') hook automatically
  await customer.remove();

  // Log deletion
  await AuditLog.create({
    action: "DELETE_CUSTOMER",
    performedBy: user._id,
    targetId: customer._id,
  });

  return true;
}

export async function deactivateCustomer(customerId, adminUser){

  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new AppError("Customer not found", 404);

  customer.isDeactivated = true;
  customer.deactivatedAt = new Date();
  await customer.save();

  await AuditLog.create({
    action: "DEACTIVATE_CUSTOMER",
    performedBy: adminUser._id,
    targetId: customer._id,
  });

  return true;
}
