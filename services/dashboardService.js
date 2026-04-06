import Transaction from "../models/Transaction.js";
import Customer from "../models/Customer.js";
import { getDateRange } from "../utils/dateFilter.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// export async function getCashierDashboard(userId, filter, status) {
//   const dateFilter = getDateRange(filter);
//   const dateMatch = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
//   const statusMatch = status ? { status } : {};

//   const match = {
//     cashierId: new mongoose.Types.ObjectId(userId),
//     ...statusMatch,
//     ...dateMatch,
//   };

//   const transactions = await Transaction.aggregate([
//     { $match: match },
//     {
//       $group: {
//         _id: "$type",
//         totalAmount: { $sum: "$amount" },
//         count: { $sum: 1 },
//       },
//     },
//   ]);

//   const summary = {
//     deposit: 0,
//     withdrawal: 0,
//     loan: 0,
//   };

//   transactions.forEach((t) => {
//     summary[t._id] = t.totalAmount;
//   });

//   const customerFilter = {
//     createdBy: new mongoose.Types.ObjectId(userId),
//     isDeactivated: false,
//     ...dateMatch,
//   };

//   const customersCreated = await Customer.countDocuments(customerFilter);

//   return {
//     cards: {
//       deposits: summary.deposit,
//       withdrawals: summary.withdrawal,
//       loans: summary.loan,
//       customers: customersCreated,
//     },
//   };
// }

export async function getCashierDashboard(userId, filter, status) {
  const dateFilter = getDateRange(filter);
  const dateMatch = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
  const statusMatch = status ? { status } : {};

  const match = {
    cashierId: new mongoose.Types.ObjectId(userId),
    ...statusMatch,
    ...dateMatch,
  };

  // ===== Transaction summary by type =====
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

  const summary = { deposit: 0, withdrawal: 0, loan: 0 };
  transactions.forEach((t) => (summary[t._id] = t.totalAmount));

  // ===== Recent transactions with customer info =====
  const recentTransactions = await Transaction.find(match)
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("customerId", "fullName publicId phone")
    .populate("approvedBy", "fullName")
    .select("publicId type amount status note createdAt customerId approvedBy");

  // ===== Transaction breakdown by status =====
  const transactionStatusBreakdown = await Transaction.aggregate([
    {
      $match: {
        cashierId: new mongoose.Types.ObjectId(userId),
        ...dateMatch,
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const transactionStatus = { pending: 0, approved: 0, rejected: 0 };
  transactionStatusBreakdown.forEach((t) => (transactionStatus[t._id] = t.count));

  // ===== Customer info =====
  const customerFilter = {
    createdBy: new mongoose.Types.ObjectId(userId),
    ...dateMatch,
  };

  const totalCustomers = await Customer.countDocuments(customerFilter);

  const customerStatusBreakdown = await Customer.aggregate([
    { $match: { createdBy: new mongoose.Types.ObjectId(userId), ...dateMatch } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const customerStatus = { pending: 0, approved: 0 };
  customerStatusBreakdown.forEach((c) => (customerStatus[c._id] = c.count));

  // ===== Recent customers =====
  const recentCustomers = await Customer.find(customerFilter)
    .sort({ createdAt: -1 })
    .limit(5)
    .select("fullName publicId phone address status createdAt");

  return {
    cards: {
      deposits: summary.deposit,
      withdrawals: summary.withdrawal,
      loans: summary.loan,
      customers: totalCustomers,
    },
    transactionStatus, // { pending: N, approved: N, rejected: N }
    customerStatus,    // { pending: N, approved: N }
    recentTransactions,
    recentCustomers,
  };
}

export async function getAdminDashboard({ filter, startDate, endDate, status, includeDeactivated = false }) {
  const dateFilter = getDateRange(filter, startDate, endDate);
  const dateMatch = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
  const statusMatch = status ? { status } : {};

  // ===== Aggregate total transactions =====
  const transactions = await Transaction.aggregate([
    { $match: { ...statusMatch, ...dateMatch } },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const summary = { deposit: 0, withdrawal: 0, loan: 0 };
  transactions.forEach((t) => (summary[t._id] = t.totalAmount));

  // ===== Count customers =====
  const customerFilter = {
    ...statusMatch,
    ...dateMatch,
    ...(!includeDeactivated && { isDeactivated: false }),
  };

  const totalCustomers = await Customer.countDocuments(customerFilter);
  const pendingCustomers = await Customer.countDocuments({
    status: "pending",
    ...(!includeDeactivated && { isDeactivated: false }),
  });
  const pendingTransactions = await Transaction.countDocuments({ status: "pending" });

  // ===== Daily cashier totals =====
  const cashierTransactions = await Transaction.aggregate([
    { $match: { ...statusMatch, ...dateMatch } },
    {
      $group: {
        _id: {
          cashierId: "$cashierId",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        deposits: { $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] } },
        withdrawals: { $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] } },
        loans: { $sum: { $cond: [{ $eq: ["$type", "loan"] }, "$amount", 0] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  // Get cashier details
  const cashierIds = [...new Set(cashierTransactions.map((t) => t._id.cashierId.toString()))];
  const cashiers = await User.find({ _id: { $in: cashierIds } }).select("fullName publicId");

  // Map cashier data with daily totals and overall totals
  const cashierSummary = cashiers.map((c) => {
    const dailyTotals = cashierTransactions
      .filter((t) => t._id.cashierId.toString() === c._id.toString())
      .map((t) => ({
        date: t._id.date,
        deposits: t.deposits,
        withdrawals: t.withdrawals,
        loans: t.loans,
        count: t.count,
      }));

    const overall = dailyTotals.reduce(
      (acc, day) => {
        acc.deposits += day.deposits;
        acc.withdrawals += day.withdrawals;
        acc.loans += day.loans;
        acc.count += day.count;
        return acc;
      },
      { deposits: 0, withdrawals: 0, loans: 0, count: 0 }
    );

    return {
      cashierId: c.publicId,
      name: c.fullName,
      dailyTotals,
      overall,
    };
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
    cashiers: cashierSummary,
  };
}

