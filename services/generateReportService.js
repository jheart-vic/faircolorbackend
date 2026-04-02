import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Loan from "../models/Loan.js";
import Customer from "../models/Customer.js";
import { getCustomerBalance } from "./customerService.js";
import User from "../models/User.js";
import { formatDateRange, getDateRange } from "../utils/dateFilter.js";
import { format } from "date-fns";
import { formatCurrency } from "../utils/currency.js";


export async function generateCustomerReport(customerId, user, res, query) {
  const { filter, startDate, endDate } = query;
  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new Error("Customer not found");

  // 🔐 ACCESS CONTROL
  if (user.role === "cashier") {
    const isOwner =
      customer.createdBy.toString() === user._id.toString() ||
      (customer.assignedTo && customer.assignedTo.toString() === user._id.toString());

    if (!isOwner) throw new Error("Not authorized");
  }

  const dateFilter = getDateRange(filter, startDate, endDate);
  const rangeLabel = formatDateRange(filter, startDate, endDate);

  const transactions = await Transaction.find({
    customerId: customer._id,
    status: "approved",
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
  }).sort({ createdAt: -1 });

  const loans = await Loan.find({
    customerId: customer._id,
    status: "approved",
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
  }).sort({ createdAt: -1 });

  const balance = await getCustomerBalance(customer._id);

  // 📄 CREATE PDF
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${customer.publicId}-report.pdf`);
  doc.pipe(res);

  // ================= HEADER =================
  doc.fontSize(20).text("Customer Financial Report", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Customer: ${customer.fullName} ${customer.isDeactivated ? "(Deactivated)" : ""}`);
  doc.text(`Phone: ${customer.phone}`);
  doc.text(`Customer ID: ${customer.publicId}`);
  doc.text(`Period: ${rangeLabel}`);
  doc.text(`Generated At: ${new Date().toLocaleString()}`);
  doc.moveDown(1);

  // ================= BALANCE =================
  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.5);

  doc.text(`Deposits: ${formatCurrency(balance.deposits)}`);
  doc.text(`Withdrawals: ${formatCurrency(balance.withdrawals)}`);
  doc.text(`Loans: ${formatCurrency(balance.loans)}`);
  doc.text(`Balance: ${formatCurrency(balance.balance)}`);
  doc.moveDown(1);

  // ================= TRANSACTIONS =================
  doc.fontSize(14).text("Transactions", { underline: true });
  doc.moveDown(0.5);

  transactions.forEach((trx, i) => {
    doc.fontSize(10).text(
      `${i + 1}. ${trx.type.toUpperCase()} - ${formatCurrency(trx.amount)} - ${format(trx.createdAt, "MMM dd, yyyy")}`
    );
  });

  doc.moveDown(1);

  // ================= LOANS =================
  doc.fontSize(14).text("Loans", { underline: true });
  doc.moveDown(0.5);

  loans.forEach((loan, i) => {
    doc.fontSize(10).text(
      `${i + 1}. Amount: ${formatCurrency(loan.amount)} | Interest: ${loan.interest}% | Duration: ${loan.duration} months`
    );
  });

  doc.end();
}

export async function generateCashierReport(query, adminUser, res) {
  if (adminUser.role !== "admin") throw new Error("Only admin can generate cashier reports");

  const { cashierId, filter, startDate, endDate } = query;
  const cashier = await User.findOne({ publicId: cashierId });
  if (!cashier) throw new Error("Cashier not found");

  const dateFilter = getDateRange(filter, startDate, endDate);
  const rangeLabel = formatDateRange(filter, startDate, endDate);

  const transactions = await Transaction.find({
    cashierId: cashier._id,
    status: "approved",
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
  })
    .populate("customerId", "fullName publicId")
    .sort({ createdAt: -1 });

  let deposits = 0, withdrawals = 0, loans = 0;
  transactions.forEach((t) => {
    if (t.type === "deposit") deposits += t.amount;
    if (t.type === "withdrawal") withdrawals += t.amount;
    if (t.type === "loan") loans += t.amount;
  });

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${cashier.publicId}-report.pdf`);
  doc.pipe(res);

  doc.fontSize(20).text("Cashier Financial Statement", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Cashier: ${cashier.fullName}`);
  doc.text(`Cashier ID: ${cashier.publicId}`);
  doc.text(`Period: ${rangeLabel}`);
  doc.text(`Generated At: ${new Date().toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.5);
  doc.text(`Total Deposits: ${formatCurrency(deposits)}`);
  doc.text(`Total Withdrawals: ${formatCurrency(withdrawals)}`);
  doc.text(`Total Loans: ${formatCurrency(loans)}`);
  doc.text(`Net Flow: ${formatCurrency(deposits - withdrawals - loans)}`);
  doc.moveDown(1);

  doc.fontSize(12).text("Transactions", { underline: true });
  doc.moveDown(0.5);

  // Column headers
  doc.fontSize(10);
  doc.text("Date", 40);
  doc.text("Customer", 120);
  doc.text("Type", 260);
  doc.text("Amount", 320);
  doc.text("Note", 400);
  doc.moveDown(0.5);

  transactions.forEach((t) => {
    const y = doc.y;
    doc.text(format(t.createdAt, "MMM dd, yyyy"), 40, y);
    doc.text(t.customerId?.fullName || "-", 120, y);
    doc.text(t.type, 260, y);
    doc.text(formatCurrency(t.amount), 320, y);
    doc.text(t.note || "-", 400, y);
    doc.moveDown();
  });

  doc.end();
}