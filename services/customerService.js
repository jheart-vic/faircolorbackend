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
        status,
        accountStatus,
    } = query

    const conditions = []

    // 🔐 Role-based filtering
    if (user.role === 'cashier') {
        conditions.push({
            $or: [
                { createdBy: user._id },
                { assignedTo: user._id },
            ],
        })
    }

    if (accountStatus === 'active') {
        conditions.push({ isDeactivated: false })
    } else if (accountStatus === 'deactivated') {
        conditions.push({ isDeactivated: true })
    }


    if (status === 'pending' || status === 'approved') {
        conditions.push({ status })
    }

    // 🔍 Search
    if (search) {
        conditions.push({
            $or: [
                { fullName: { $regex: search, $options: 'i' } },
                { surname: { $regex: search, $options: 'i' } },
                { otherName: { $regex: search, $options: 'i' } },
            ],
        })
    }

    // 📞 Phone filter
    if (phone) {
        conditions.push({
            phone: { $regex: `^${phone}`, $options: 'i' }, // safer
        })
    }

    // 🧠 Final filter
    const filter = conditions.length ? { $and: conditions } : {}

    // 🛡️ Safe pagination
    const safePage = Math.max(1, Number(page))
    const safeLimit = Math.min(50, Math.max(1, Number(limit)))
    const skip = (safePage - 1) * safeLimit

    const [data, total] = await Promise.all([
        Customer.find(filter)
            .populate('createdBy', 'fullName publicId')
            .populate('assignedTo', 'fullName publicId')
            .populate('approvedBy', 'fullName publicId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(safeLimit),

        Customer.countDocuments(filter),
    ])

    return {
        data,
        pagination: {
            total,
            page: safePage,
            limit: safeLimit,
            pages: Math.ceil(total / safeLimit),
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

export async function toggleCustomerDeactivation(customerId, adminUser) {
  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new AppError("Customer not found", 404);

  const isDeactivating = !customer.isDeactivated;

  customer.isDeactivated = isDeactivating;
  customer.deactivatedAt = isDeactivating ? new Date() : null;
  customer.deactivatedBy = isDeactivating ? adminUser._id : null;

  await customer.save();

  await AuditLog.create({
    action: isDeactivating
      ? "DEACTIVATE_CUSTOMER"
      : "RESTORE_CUSTOMER",
    performedBy: adminUser._id,
    targetId: customer._id,
  });

  return customer;
}
