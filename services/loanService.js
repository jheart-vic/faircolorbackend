import Loan from "../models/Loan.js";
import Customer from "../models/Customer.js";
import AuditLog from "../models/AuditLog.js";
import Transaction from "../models/Transaction.js";

export async function createLoan(payload, cashierId) {
  const { customerId, amount, interest, duration } = payload;

  if (!customerId || !amount || !interest || !duration) {
    throw new Error("All fields are required");
  }

  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new Error("Customer not found");

  if (customer.status !== "approved") {
    throw new Error("Customer not approved");
  }

  const loan = await Loan.create({
    customerId: customer._id,
    amount,
    createdBy: cashierId,
    interest,
    duration,
    status: "pending",
  });

  await AuditLog.create({
    action: "CREATE_LOAN",
    performedBy: cashierId,
    targetId: loan.publicId,
  });

  return loan;
}

export async function approveLoan(loanId, adminId) {
  const loan = await Loan.findOne({ publicId: loanId });

  if (!loan) throw new Error("Loan not found");

  if (loan.status !== "pending") {
    throw new Error("Loan already processed");
  }
  // Approve loan
  loan.status = "approved";
  loan.approvedBy = adminId;
  await loan.save();

  // 🔥 Create transaction AFTER approval
  const transaction = await Transaction.create({
    type: "loan",
    amount: loan.amount,
    customerId: loan.customerId,
    cashierId: loan.createdBy,
    approvedBy: adminId,
    status: "approved",
    note: `Loan disbursed  for (${loan.publicId})`,
    loanId: loan._id,
  });

  await AuditLog.create({
    action: "APPROVE_LOAN",
    performedBy: adminId,
    targetId: loan.publicId,
  });

  return { loan, transaction };
}

export async function getLoans(query) {
  const {
    page = 1,
    limit = 10,
    status,
    customerId,
    startDate,
    endDate,
  } = query;

  const filter = {};

  // Filters
  if (status) {
    filter.status = status;
  }

if (customerId) {
  const customer = await Customer.findOne({ publicId: customerId })
  if (customer) {
    filter.customerId = customer._id;
  }
}

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Loan.find(filter)
      .populate("customerId", "fullName phone publicId")
      .populate("approvedBy", "fullName publicId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),

    Loan.countDocuments(filter),
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

export async function rejectLoan(loanId, adminId) {
  const loan = await Loan.findOne({ publicId: loanId });

  if (!loan) throw new Error("Loan not found");


  if (loan.status !== "pending") {
    throw new Error("Loan already processed");
  }
  loan.status = "rejected";
  loan.rejectedBy = adminId;
  await loan.save();
  await AuditLog.create({
    action: "REJECT_LOAN",
    performedBy: adminId,
    targetId: loan.publicId,
  });
  return loan;
}