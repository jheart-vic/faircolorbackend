import Transaction from "../models/Transaction.js";
import Customer from "../models/Customer.js";
import { getDateRange } from "../utils/dateFilter.js";

// export async function getAdminDashboard({filter, startDate, endDate, includeDeactivated = false}) {
//   const dateFilter = getDateRange(filter, startDate, endDate);

//   const match = {
//     ...(status && { status }),
//     ...(!status && { status: "approved" }),
//     ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
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

//   // Filter customers by deactivation
//   const customerFilter = {
//     status: "approved",
//     ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
//     ...(includeDeactivated ? {} : { isDeactivated: false }),
//   };

//   const totalCustomers = await Customer.countDocuments(customerFilter);

//   const pendingCustomers = await Customer.countDocuments({
//     status: "pending",
//     ...(includeDeactivated ? {} : { isDeactivated: false }),
//   });


//   const pendingTransactions = await Transaction.countDocuments({
//     status: "pending",
//   });

//   return {
//     cards: {
//       deposits: summary.deposit,
//       withdrawals: summary.withdrawal,
//       loans: summary.loan,
//       customers: totalCustomers,
//     },
//     pending: {
//       customers: pendingCustomers,
//       transactions: pendingTransactions,
//     },
//   };
// }

// export async function getAdminDashboard({ filter, startDate, endDate, includeDeactivated = false }) {
//   const dateFilter = getDateRange(filter, startDate, endDate);

//   // ===== Aggregate total transactions =====
//   const transactions = await Transaction.aggregate([
//     { $match: { status: "approved", ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) } },
//     {
//       $group: {
//         _id: "$type",
//         totalAmount: { $sum: "$amount" },
//         count: { $sum: 1 },
//       },
//     },
//   ]);

//   const summary = { deposit: 0, withdrawal: 0, loan: 0 };
//   transactions.forEach((t) => (summary[t._id] = t.totalAmount));

//   // ===== Count customers =====
//   const customerFilter = { status: "approved", ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) };
//   if (!includeDeactivated) customerFilter.isDeactivated = false;

//   const totalCustomers = await Customer.countDocuments(customerFilter);
//   const pendingCustomers = await Customer.countDocuments({
//     status: "pending",
//     ...(includeDeactivated ? {} : { isDeactivated: false }),
//   });
//   const pendingTransactions = await Transaction.countDocuments({ status: "pending" });

//   // ===== Daily cashier totals =====
//   // Group by cashier and date (YYYY-MM-DD)
//   const cashierTransactions = await Transaction.aggregate([
//     { $match: { status: "approved", ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) } },
//     {
//       $group: {
//         _id: {
//           cashierId: "$cashierId",
//           date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
//         },
//         deposits: { $sum: { $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0] } },
//         withdrawals: { $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] } },
//         loans: { $sum: { $cond: [{ $eq: ["$type", "loan"] }, "$amount", 0] } },
//         count: { $sum: 1 },
//       },
//     },
//     { $sort: { "_id.date": 1 } },
//   ]);

//   // Get cashier details
//   const cashierIds = [...new Set(cashierTransactions.map((t) => t._id.cashierId.toString()))];
//   const cashiers = await User.find({ _id: { $in: cashierIds } }).select("fullName publicId");

//   // Map cashier data with daily totals
//   const cashierSummary = cashiers.map((c) => {
//     const dailyTotals = cashierTransactions
//       .filter((t) => t._id.cashierId.toString() === c._id.toString())
//       .map((t) => ({
//         date: t._id.date,
//         deposits: t.deposits,
//         withdrawals: t.withdrawals,
//         loans: t.loans,
//         count: t.count,
//       }));

//     return {
//       cashierId: c.publicId,
//       name: c.fullName,
//       dailyTotals,
//     };
//   });

//   return {
//     cards: {
//       deposits: summary.deposit,
//       withdrawals: summary.withdrawal,
//       loans: summary.loan,
//       customers: totalCustomers,
//     },
//     pending: {
//       customers: pendingCustomers,
//       transactions: pendingTransactions,
//     },
//     cashiers: cashierSummary,
//   };
// }

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

export async function getAdminDashboard({ filter, startDate, endDate, includeDeactivated = false }) {
  const dateFilter = getDateRange(filter, startDate, endDate);

  // ===== Aggregate total transactions =====
  const transactions = await Transaction.aggregate([
    { $match: { status: "approved",  ...(status && { status }),
    ...(!status && { status: "approved" }), ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) } },
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
  const customerFilter = { status: "approved", ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) };
  if (!includeDeactivated) customerFilter.isDeactivated = false;

  const totalCustomers = await Customer.countDocuments(customerFilter);
  const pendingCustomers = await Customer.countDocuments({
    status: "pending",
    ...(includeDeactivated ? {} : { isDeactivated: false }),
  });
  const pendingTransactions = await Transaction.countDocuments({ status: "pending" });

  // ===== Daily cashier totals =====
  const cashierTransactions = await Transaction.aggregate([
    { $match: { status: "approved", ...(Object.keys(dateFilter).length && { createdAt: dateFilter }) } },
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

    // Compute overall totals for this cashier
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
      overall, // new overall totals per cashier
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
    cashiers: cashierSummary, // daily + overall
  };
}