import Customer from "../models/Customer.js";
import AuditLog from "../models/AuditLog.js";
import { normalizePhone } from "../utils/normalizePhone.js";

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
  });

  // Audit log
  await AuditLog.create({
    action: "CREATE_CUSTOMER",
    performedBy: userId,
    targetId: customer._id,
  });

  return customer;
}

export async function getCustomers(query) {
  const {
    page = 1,
    limit = 10,
    search,
    phone,
  } = query;

  const filter = {};

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
    ];
  }

  if (phone) {
    filter.phone = { $regex: phone };
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Customer.find(filter)
      .populate("createdBy", "name", "publicId")
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

