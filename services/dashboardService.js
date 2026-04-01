import Transaction from "../models/Transaction.js";
import Customer from "../models/Customer.js";
import { getDateRange } from "../utils/dateFilter.js";

export async function getAdminDashboard(filter) {
  const dateFilter = getDateRange(filter);

  const match = {
    status: "approved",
    createdAt: dateFilter,
  };

  const transactions = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  // Convert to object
  const summary = {
    deposit: 0,
    withdrawal: 0,
    loan: 0,
  };

  transactions.forEach((t) => {
    summary[t._id] = t.totalAmount;
  });

  const totalCustomers = await Customer.countDocuments({
    createdAt: dateFilter,
    status: "approved",
  });

  const pendingCustomers = await Customer.countDocuments({
    status: "pending",
  });

  const pendingTransactions = await Transaction.countDocuments({
    status: "pending",
  });

  return {
    cards: {
      deposits: summary.deposit,
      withdrawals: summary.withdrawal,
      loans: summary.loan,
      customers: totalCustomers,
    },
    pending: {
      customers: pendingCustomers,
      transactions: pendingTransactions,
    },
  };
}

export async function getCashierDashboard(userId, filter) {
  const dateFilter = getDateRange(filter);

  const match = {
    cashierId: userId,
    status: "approved",
    createdAt: dateFilter,
  };

  const transactions = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = {
    deposit: 0,
    withdrawal: 0,
    loan: 0,
  };

  transactions.forEach((t) => {
    summary[t._id] = t.totalAmount;
  });

  const customersCreated = await Customer.countDocuments({
    createdBy: userId,
    createdAt: dateFilter,
  });

  return {
    cards: {
      deposits: summary.deposit,
      withdrawals: summary.withdrawal,
      loans: summary.loan,
      customers: customersCreated,
    },
  };
}

