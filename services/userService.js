import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

export async function createCashier(payload, adminId) {
  const { name, email, password } = payload;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new Error("Email already in use");
  }

  const cashier = await User.create({
    name,
    email: email.toLowerCase().trim(),
    password,
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
    name: cashier.name,
    email: cashier.email,
    role: cashier.role,
  };
}


export async function getCashiers(query) {
  const {
    page = 1,
    limit = 10,
    name,
    email,
  } = query;

  const filter = { role: "cashier" };

  if (name) {
    filter.name = { $regex: name, $options: "i" };
  }

  if (email) {
    filter.email = { $regex: email, $options: "i" };
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    User.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 }),

    User.countDocuments(filter),
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