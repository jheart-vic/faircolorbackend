import Loan from "../models/Loan.js";
import Customer from "../models/Customer.js";
import AuditLog from "../models/AuditLog.js";
import Transaction from "../models/Transaction.js";
import AppError from "../utils/appError.js";

const INTEREST_RATES = {
  1: 12,
  2: 20,
  3: 25,
  4: 30,
  6: 35,
};

export async function createLoan(payload, cashierId) {
    const { customerId, amount, duration, purpose, repaymentMethod, guarantor } = payload

    if (!customerId || !amount || !duration) {
        throw new AppError('All fields are required', 400)
    }

    const interestRate = INTEREST_RATES[duration]
    if (!interestRate) {
        throw new AppError(
            `Invalid duration. Allowed durations: ${Object.keys(INTEREST_RATES).join(', ')} month(s)`,
            400,
        )
    }

    const customer = await Customer.findOne({
        publicId: customerId,
        $or: [{ createdBy: cashierId }, { assignedTo: cashierId }],
    })
    if (!customer) throw new AppError('Customer not found or not assigned to you', 404)
    if (customer.status !== 'approved') throw new AppError('Customer not approved', 400)

    const amountToPay = amount + (amount * interestRate / 100)
    const monthlyPayment = amountToPay / duration

    const loan = await Loan.create({
        customerId: customer._id,
        amount,
        interest: interestRate,
        duration,
        amountToPay,
        monthlyPayment,
        purpose,
        repaymentMethod,
        guarantor,
        createdBy: cashierId,
        status: 'pending',
    })

    await AuditLog.create({
        action: 'CREATE_LOAN',
        performedBy: cashierId,
        targetId: loan._id,
    })

    return Loan.findById(loan._id)
        .populate('customerId', 'fullName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .select('publicId amount interest amountToPay monthlyPayment duration purpose repaymentMethod guarantor status createdAt customerId createdBy')
}

export async function approveLoan(loanId, adminId) {
  const loan = await Loan.findOne({ publicId: loanId });
  if (!loan) throw new AppError("Loan not found", 404);

  if (loan.status !== "pending") {
    throw new AppError("Loan already processed", 400);
  }

  loan.status = "approved";
  loan.approvedBy = adminId;
  await loan.save();

  const transaction = await Transaction.create({
    type: "loan",
    amount: loan.amount,
    customerId: loan.customerId,
    cashierId: loan.createdBy,
    approvedBy: adminId,
    status: "approved",
    note: `Loan disbursed for (${loan.publicId})`,
    loanId: loan._id,
  });

  await AuditLog.create({
    action: "APPROVE_LOAN",
    performedBy: adminId,
    targetId: loan._id,
  });

  // Return populated loan and transaction
  const populatedLoan = await Loan.findById(loan._id)
    .populate("customerId", "fullName publicId phone address")
    .populate("createdBy", "fullName publicId")
    .populate("approvedBy", "fullName publicId")
    .select("publicId amount interest  amountToPay monthlyPayment duration status createdAt customerId createdBy approvedBy");

  const populatedTransaction = await Transaction.findById(transaction._id)
    .populate('customerId', 'fullName surname otherName publicId phone')
    .populate('cashierId', 'fullName publicId')
    .populate('approvedBy', 'fullName publicId')
    .populate('loanId', 'guarantor publicId')
    .select('publicId type amount status note createdAt customerId cashierId approvedBy loanId')

  return { loan: populatedLoan, transaction: populatedTransaction };
}

export async function getLoans(query) {
    const {
        page = 1,
        limit = 10,
        status,
        customerId,
        startDate,
        endDate,
    } = query

    const filter = {}

    if (status) filter.status = status

    if (customerId) {
        const customer = await Customer.findOne({ publicId: customerId })
        if (customer) filter.customerId = customer._id
    }

    if (startDate || endDate) {
        filter.createdAt = {}
        if (startDate) filter.createdAt.$gte = new Date(startDate)
        if (endDate) filter.createdAt.$lte = new Date(endDate)
    }

    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
        Loan.find(filter)
            .populate('customerId', 'fullName surname otherName phone publicId address')
            .populate('createdBy', 'fullName publicId')
            .populate('approvedBy', 'fullName publicId')
            .populate('rejectedBy', 'fullName publicId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),

        Loan.countDocuments(filter),
    ])

    return {
        data,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit),
        },
    }
}

export async function rejectLoan(loanId, adminId) {
    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (loan.status !== 'pending') {
        throw new AppError('Loan already processed', 400)
    }

    loan.status = 'rejected'
    loan.rejectedBy = adminId
    await loan.save()

    await AuditLog.create({
        action: 'REJECT_LOAN',
        performedBy: adminId,
        targetId: loan._id,
    })

    const populatedLoan = await Loan.findById(loan._id)
        .populate('customerId', 'fullName surname otherName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .populate('rejectedBy', 'fullName publicId')
        .select('publicId amount interest duration purpose repaymentMethod status createdAt customerId createdBy rejectedBy')

    return { loan: populatedLoan }
}

export async function updateCreditAnalysis(loanId, payload, adminId) {
    const loan = await Loan.findOne({ publicId: loanId })
    if (!loan) throw new AppError('Loan not found', 404)

    if (loan.status === 'rejected') {
        throw new AppError('Cannot update credit analysis on a rejected loan', 400)
    }

    const {
        guarantyFund,
        upfrontCharges,
        expectedInterest,
        totalIncomeExpected,
        repaymentPlan,
        accountOfficer,
        headBusinessDevelopment,
        hopFincon,
        internalControl,
        accountNo,
    } = payload

    loan.creditAnalysis = {
        guarantyFund,
        upfrontCharges,
        expectedInterest,
        totalIncomeExpected,
        repaymentPlan,
        accountOfficer,
        headBusinessDevelopment,
        hopFincon,
        internalControl,
        accountNo,
    }

    await loan.save()

    await AuditLog.create({
        action: 'UPDATE_CREDIT_ANALYSIS',
        performedBy: adminId,
        targetId: loan._id,
    })

    return Loan.findById(loan._id)
        .populate('customerId', 'fullName publicId phone address')
        .populate('createdBy', 'fullName publicId')
        .populate('approvedBy', 'fullName publicId')
        .select('publicId amount interest amountToPay monthlyPayment duration purpose repaymentMethod status creditAnalysis createdAt customerId createdBy approvedBy')
}