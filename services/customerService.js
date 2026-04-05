import Customer from "../models/Customer.js";
import AuditLog from "../models/AuditLog.js";
import { normalizePhone } from "../utils/normalizePhone.js";
import Transaction from "../models/Transaction.js";

export async function createCustomer(payload, userId) {
  const { fullName, phone, address } = payload;

  const normalizedPhone = normalizePhone(phone);

  const existing = await Customer.findOne({ phone: normalizedPhone });
  if (existing) {
    throw new Error("Customer with this phone already exists");
  }

  const customer = await Customer.create({
    fullName,
    phone: normalizedPhone,
    address,
    createdBy: userId,
    status: "pending",
   publicId:existing ? existing.publicId : undefined, // reuse publicId if customer was soft-deleted
  });

  // Audit log
  await AuditLog.create({
    action: "CREATE_CUSTOMER",
    performedBy: userId,
    targetId: customer._id,
  });

  return customer;
}

export async function getCustomers(query, user,  includeDeactivated = false) {
  const {
    page = 1,
    limit = 10,
    search,
    phone,
  } = query;

  const filter = {};

  // 🔐 ROLE-BASED ACCESS
  if (user.role === "cashier") {
    filter.$or = [
      { createdBy: user._id },     // customers they created
      { assignedTo: user._id },    // customers assigned to them (future-proof)
    ];
  }

  // Include soft-deleted only if admin wants
  if (!includeDeactivated) {
    filter.isDeactivated = false;
  }

  // 🔍 SEARCH
  if (search) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [{ fullName: { $regex: search, $options: "i" } }],
    });
  }

  if (phone) {
    filter.$and = filter.$and || [];
    filter.$and.push({
      phone: { $regex: phone },
    });
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Customer.find(filter)
      .populate("createdBy", "fullName publicId")
      .populate("assignedTo", "fullName publicId") // safe even if not yet in schema
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 }),

    Customer.countDocuments(filter),
  ]);

  return {
    data,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    },
  };
}

// export async function getCustomers(query) {
//   const {
//     page = 1,
//     limit = 10,
//     search,
//     phone,
//   } = query;

//   const filter = {};

//   if (search) {
//     filter.$or = [
//       { fullName: { $regex: search, $options: "i" } },
//     ];
//   }

//   if (phone) {
//     filter.phone = { $regex: phone };
//   }

//   const skip = (page - 1) * limit;

//   const [data, total] = await Promise.all([
//     Customer.find(filter)
//       .populate("createdBy", "fullName", "publicId")
//       .skip(skip)
//       .limit(Number(limit))
//       .sort({ createdAt: -1 }),

//     Customer.countDocuments(filter),
//   ]);

//   return {
//     data,
//     pagination: {
//       total,
//       page: Number(page),
//       limit: Number(limit),
//       pages: Math.ceil(total / limit),
//     },
//   };
// }

export async function approveCustomer(customerId, adminId) {
  const customer = await Customer.findOne({ publicId: customerId });

  if (!customer) throw new Error("Customer not found");

  if (customer.status === "approved") {
    throw new Error("Customer already approved");
  }

  customer.status = "approved";
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

  if (!customer) throw new Error("Customer not found");

  // 🔐 ACCESS CONTROL
  if (user.role === "cashier") {
    const isOwner =
      customer.createdBy.toString() === user._id.toString() ||
      (customer.assignedTo &&
        customer.assignedTo.toString() === user._id.toString());

    if (!isOwner) {
      throw new Error("Not authorized to view this customer's balance");
    }
  }

  return getCustomerBalance(customer._id);
}

export async function deleteCustomer(customerId, user) {
  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new Error("Customer not found");

  // Only admin
  if (user.role !== "admin") {
    throw new Error("Not authorized to delete this customer");
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

export async function deactivateCustomer(customerId, adminUser) {
  if (adminUser.role !== "admin") throw new Error("Only admin can deactivate customers");

  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new Error("Customer not found");

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
