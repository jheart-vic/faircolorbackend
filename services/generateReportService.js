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
  const customer = await Customer.findOne({ publicId: customerId });
const { filter, startDate, endDate } = query;

const dateFilter = getDateRange(filter, startDate, endDate);
const rangeLabel = formatDateRange(filter, startDate, endDate);
  if (!customer) throw new Error("Customer not found");

  // 🔐 ACCESS CONTROL
  if (user.role === "cashier") {
    const isOwner =
      customer.createdBy.toString() === user._id.toString() ||
      (customer.assignedTo &&
        customer.assignedTo.toString() === user._id.toString());

    if (!isOwner) {
      throw new Error("Not authorized");
    }
  }

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

  // 🔥 STREAM TO RESPONSE
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${customer.publicId}-report.pdf`
  );

  doc.pipe(res);

  // ================= HEADER =================
  doc.fontSize(20).text("Customer Financial Report", { align: "center" });
  doc.moveDown();

  doc.fontSize(12).text(`Customer: ${customer.fullName}`);
  doc.text(`Phone: ${customer.phone}`);
  doc.text(`Customer ID: ${customer.publicId}`);
  doc.text(`Period: ${rangeLabel}`);
  doc.text(`Generated At: ${new Date().toLocaleString()}`);
  doc.moveDown();
  doc.moveDown();

  // ================= BALANCE =================
  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.5);

  doc.text(`Deposits: ${formatCurrency(balance.deposits)}`);
  doc.text(`Withdrawals: ${formatCurrency(balance.withdrawals)}`);
  doc.text(`Loans: ${formatCurrency(balance.loans)}`);
  doc.text(`Balance: ${formatCurrency(balance.balance)}`);
  doc.moveDown();

  // ================= TRANSACTIONS =================
  doc.fontSize(14).text("Transactions", { underline: true });
  doc.moveDown(0.5);

  transactions.forEach((trx, i) => {
    doc
      .fontSize(10)
      .text(
        `${i + 1}. ${trx.type.toUpperCase()} - ${trx.amount} - ${format(trx.createdAt, "MMM dd, yyyy")}`
      );
  });

  doc.moveDown();

  // ================= LOANS =================
  doc.fontSize(14).text("Loans", { underline: true });
  doc.moveDown(0.5);

  loans.forEach((loan, i) => {
    doc
      .fontSize(10)
      .text(
        `${i + 1}. Amount: ${formatCurrency(loan.amount)} | Interest:   ${loan.interest}% | Duration: ${loan.duration} months`
      );
  });


  // ✅ FINALIZE
  doc.end();
}

export async function generateCashierReport(query, adminUser, res) {
  if (adminUser.role !== "admin") {
    throw new Error("Only admin can generate cashier reports");
  }
const rangeLabel = formatDateRange(filter, startDate, endDate);

  const { cashierId, filter, startDate, endDate } = query;

  const cashier = await User.findOne({ publicId: cashierId });
  if (!cashier) throw new Error("Cashier not found");

  const dateFilter = getDateRange(filter, startDate, endDate);

  const transactions = await Transaction.find({
    cashierId: cashier._id,
    status: "approved",
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
  })
    .populate("customerId", "fullName publicId")
    .sort({ createdAt: -1 });

  // ================= SUMMARY =================
  let deposits = 0;
  let withdrawals = 0;
  let loans = 0;

  transactions.forEach((t) => {
    if (t.type === "deposit") deposits += t.amount;
    if (t.type === "withdrawal") withdrawals += t.amount;
    if (t.type === "loan") loans += t.amount;
  });

  // ================= PDF =================
  const doc = new PDFDocument({ margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${cashier.publicId}-report.pdf`
  );

  doc.pipe(res);

  // ===== HEADER =====
  doc
    .fontSize(20)
    .text("Cashier Financial Statement", { align: "center" });

  doc.moveDown();
  doc.fontSize(12).text(`Cashier: ${cashier.fullName}`);
  doc.text(`Cashier ID: ${cashier.publicId}`);
  doc.text(`Period: ${rangeLabel}`);
doc.text(`Generated At: ${new Date().toLocaleString()}`);
  doc.moveDown();

  // ===== SUMMARY =====
  doc.fontSize(14).text("Summary", { underline: true });
  doc.moveDown(0.5);

  doc.text(`Total Deposits: ${formatCurrency(deposits)}`);
  doc.text(`Total Withdrawals: ${formatCurrency(withdrawals)}`);
  doc.text(`Total Loans: ${formatCurrency(loans)}`);
  doc.text(`Net Flow: ${formatCurrency(deposits - withdrawals - loans)}`);
  doc.moveDown();

  // ===== TABLE HEADER =====
  doc.fontSize(12).text("Transactions", { underline: true });
  doc.moveDown(0.5);

  // Column headers
  doc.fontSize(10);
  doc.text("Date", 40);
  doc.text("Customer", 120);
  doc.text("Type", 260);
  doc.text("Amount", 320);
  doc.text("Note", 400);

  doc.moveDown();

  // ===== TABLE ROWS =====
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