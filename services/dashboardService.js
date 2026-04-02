import Transaction from "../models/Transaction.js";
import Customer from "../models/Customer.js";
import { getDateRange } from "../utils/dateFilter.js";

export async function getAdminDashboard({filter, startDate, endDate, includeDeactivated = false}) {
  const dateFilter = getDateRange(filter, startDate, endDate);

  const match = {
    ...(status && { status }),
    ...(!status && { status: "approved" }),
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
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

  // Filter customers by deactivation
  const customerFilter = {
    status: "approved",
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
    ...(includeDeactivated ? {} : { isDeactivated: false }),
  };

  const totalCustomers = await Customer.countDocuments(customerFilter);

  const pendingCustomers = await Customer.countDocuments({
    status: "pending",
    ...(includeDeactivated ? {} : { isDeactivated: false }),
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
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
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

  const customerFilter = {
    createdBy: userId,
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
     isDeactivated: false,
  };

  const customersCreated = await Customer.countDocuments(customerFilter);

  return {
    cards: {
      deposits: summary.deposit,
      withdrawals: summary.withdrawal,
      loans: summary.loan,
      customers: customersCreated,
    },
  };
}
