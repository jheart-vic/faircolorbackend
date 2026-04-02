import Transaction from "../models/Transaction.js";
import Customer from "../models/Customer.js";
import AuditLog from "../models/AuditLog.js";
import { getCustomerBalance } from "./customerService.js";

async function createTransaction(type, payload, cashierId) {
  const { customerId, amount, note } = payload;

  if (!customerId || !amount) {
    throw new Error("customerId and amount are required");
  }

  if (amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  // 🔍 Ensure customer exists (support both publicId and _id)
  const customer =
    (await Customer.findOne({ publicId: customerId })) ||
    (await Customer.findById(customerId));

  if (!customer) throw new Error("Customer not found");

  if (customer.status !== "approved") {
    throw new Error("Customer not approved");
  }

  // 💰 BALANCE CHECK (ONLY FOR WITHDRAWALS)
  if (type === "withdrawal") {
    const balanceData = await getCustomerBalance(customer._id);

    if (amount > balanceData.balance) {
      throw new Error("Insufficient balance");
    }
  }

  // 🧾 CREATE TRANSACTION
  const transaction = await Transaction.create({
    type,
    amount,
    customerId: customer._id,
    cashierId,
    note,
    status: "pending",
  });

  // 🧠 AUDIT LOG
  await AuditLog.create({
    action: `CREATE_${type.toUpperCase()}`,
    performedBy: cashierId,
    targetId: transaction._id,
  });

  return transaction;
}

export async function createDeposit(payload, cashierId) {
  return createTransaction("deposit", payload, cashierId);
}

export async function createWithdrawal(payload, cashierId) {
  return createTransaction("withdrawal", payload, cashierId);
}

export async function getTransactions(query) {
  const {
    page = 1,
    limit = 10,
    type,
    status,
    startDate,
    endDate,
  } = query;

  const filter = {};

  if (type) filter.type = type;
  if (status) filter.status = status;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Transaction.find(filter)
      .populate("customerId", "firstName lastName")
      .populate("cashierId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),

    Transaction.countDocuments(filter),
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

export async function approveTransaction(transactionId, adminId) {
  const transaction = await Transaction.findById({publicId: transactionId});

  if (!transaction) throw new Error("Transaction not found");

  if (transaction.status !== "pending") {
    throw new Error("Transaction already processed");
  }

  transaction.status = "approved";
  transaction.approvedBy = adminId;

  await transaction.save();

  await AuditLog.create({
    action: "APPROVE_TRANSACTION",
    performedBy: adminId,
    targetId: transaction._id,
  });

  return transaction;
}

export async function rejectTransaction(transactionId, adminId) {
  const transaction = await Transaction.findById(transactionId);

  if (!transaction) throw new Error("Transaction not found");

  transaction.status = "rejected";
  transaction.rejectedBy = adminId;

  await transaction.save();

  return transaction;
}