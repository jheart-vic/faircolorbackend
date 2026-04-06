import PDFDocument from "pdfkit";
import Transaction from "../models/Transaction.js";
import Loan from "../models/Loan.js";
import Customer from "../models/Customer.js";
import { getCustomerBalance } from "./customerService.js";
import User from "../models/User.js";
import { formatDateRange, getDateRange } from "../utils/dateFilter.js";
import AppError from "../utils/appError.js";

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  darkBlue:  "#0F2B4C",
  midBlue:   "#1A4A8A",
  accent:    "#2E6FD9",
  lightBlue: "#EBF2FF",
  success:   "#16A34A",
  danger:    "#DC2626",
  warning:   "#D97706",
  grey:      "#6B7280",
  lightGrey: "#F9FAFB",
  border:    "#E5E7EB",
  headerBg:  "#F8FAFF",
  white:     "#FFFFFF",
  black:     "#111827",
};

// ── Currency (no symbol font issues) ─────────────────────────────────────────
function fc(amount) {
  const num = parseFloat(amount || 0).toFixed(2);
  const [integer, decimal] = num.split(".");
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `NGN ${formatted}.${decimal}`;
}

// ── Page width helpers ────────────────────────────────────────────────────────
const MARGIN = 30;
const pageW = (doc) => doc.page.width;
const bW    = (doc) => pageW(doc) - MARGIN * 2; // ~535

const fdate = (dt) => {
  try {
    return new Date(dt).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return String(dt); }
};

const fdatetime = (dt) => {
  try {
    const d = new Date(dt);
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      "  " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    );
  } catch { return String(dt); }
};

const statusColor = (s) => s === "approved" ? C.success : s === "rejected" ? C.danger : C.warning;
const typeColor   = (t) => t === "deposit"  ? C.success : t === "withdrawal" ? C.danger : C.accent;

// ── Drawing Helpers ───────────────────────────────────────────────────────────
function drawRect(doc, x, y, w, h, color, radius = 0) {
  doc.save().roundedRect(x, y, w, h, radius).fill(color).restore();
}

function drawBorderRect(doc, x, y, w, h, fill, border, radius = 0) {
  doc.save()
    .roundedRect(x, y, w, h, radius).fill(fill)
    .roundedRect(x, y, w, h, radius).stroke(border)
    .restore();
}

function drawLine(doc, x1, y1, x2, y2, color, lw = 0.5) {
  doc.save().moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(lw).stroke().restore();
}

function txt(doc, str, x, y, opts = {}) {
  const { size = 9, color = C.black, font = "Helvetica", width, align = "left" } = opts;
  doc.save().font(font).fontSize(size).fillColor(color);
  const o = { align, lineBreak: !!width };
  if (width) o.width = width;
  doc.text(String(str ?? "—"), x, y, o).restore();
}

// ── Shared: Header Banner ─────────────────────────────────────────────────────
function drawBanner(doc, leftLines, rightLines) {
  const bh = 90;
  drawRect(doc, MARGIN, MARGIN, bW(doc), bh, C.darkBlue, 6);

  // Left lines: [{text, size, color, font}]
  let ly = MARGIN + 14;
  leftLines.forEach(({ text: t, size = 8, color = "#A8C4E8", font = "Helvetica" }) => {
    txt(doc, t, MARGIN + 16, ly, { size, color, font });
    ly += size + 8;
  });

  // Right lines
  const rX = MARGIN + bW(doc) - 220;
  let ry = MARGIN + 14;
  rightLines.forEach(({ text: t, size = 8, color = "#A8C4E8", font = "Helvetica" }) => {
    txt(doc, t, rX, ry, { size, color, font, width: 200, align: "right" });
    ry += size + 8;
  });

  return MARGIN + bh + 16;
}

// ── Shared: Section Header ────────────────────────────────────────────────────
function drawSectionHeader(doc, title, y) {
  drawRect(doc, MARGIN, y, bW(doc), 26, C.lightBlue);
  drawRect(doc, MARGIN, y + 24, bW(doc), 2.5, C.accent);
  txt(doc, title, MARGIN + 8, y + 7, { size: 10, color: C.darkBlue, font: "Helvetica-Bold" });
  return y + 36;
}

// ── Shared: Table Header ──────────────────────────────────────────────────────
function drawTableHeader(doc, cols, y, rowH = 26) {
  drawRect(doc, MARGIN, y, bW(doc), rowH, C.midBlue);
  drawRect(doc, MARGIN, y + rowH - 1.5, bW(doc), 1.5, C.accent);
  let cx = MARGIN;
  cols.forEach((col) => {
    txt(doc, col.label, cx + 5, y + 8, {
      size: 8, color: C.white, font: "Helvetica-Bold",
      width: col.w - 8, align: col.align || "left",
    });
    cx += col.w;
  });
  return y + rowH;
}

// ── Shared: Summary Cards ─────────────────────────────────────────────────────
function drawSummaryCards(doc, balance, y) {
  y = drawSectionHeader(doc, "FINANCIAL SUMMARY", y);
  const W = bW(doc);
  const cardW = (W - 9) / 4;
  const cardH = 72;

    const netBalanceColor = (() => {
      const net = balance.deposits - balance.withdrawals;

      // only treat as loss if withdrawals exceed deposits
      if (net < 0) return C.danger;

      return C.success;
    })();
  const cards = [
    { label: "Total Deposits",    value: balance.deposits,    color: C.success, bg: "#F0FDF4" },
    { label: "Total Withdrawals", value: balance.withdrawals, color: C.danger,  bg: "#FEF2F2" },
    { label: "Total Loans",       value: balance.loans,       color: C.accent,  bg: C.lightBlue },
    { label: "Net Balance",       value: balance.balance,     color: netBalanceColor, bg: C.headerBg },
  ];

  cards.forEach((card, i) => {
    const cx = MARGIN + i * (cardW + 3);
    drawBorderRect(doc, cx, y, cardW, cardH, card.bg, C.border, 4);
    drawRect(doc, cx, y, cardW, 4, card.color, 4);
    txt(doc, fc(card.value), cx + 4, y + 16, {
      size: 11, color: card.color, font: "Helvetica-Bold",
      width: cardW - 8, align: "center",
    });
    txt(doc, card.label, cx + 4, y + 38, {
      size: 7, color: C.grey, width: cardW - 8, align: "center",
    });
  });

  return y + cardH + 16;
}

// ── Shared: Footer ────────────────────────────────────────────────────────────
function drawFooter(doc) {
  const ph = doc.page.height, pw = doc.page.width;
  drawRect(doc, 0, ph - 36, pw, 36, C.darkBlue);
  txt(doc, "FairColor Bank  -  This is a system-generated report and does not require a signature.", 0, ph - 26, { size: 7, color: C.white, width: pw, align: "center" });
  txt(doc, "Confidential - For authorized use only", 0, ph - 14, { size: 7, color: "#A8C4E8", width: pw, align: "center" });
}

// ── Customer Info Block ───────────────────────────────────────────────────────
function drawCustomerInfo(doc, customer, y) {
  y = drawSectionHeader(doc, "CUSTOMER INFORMATION", y);
  const rowH = 56;
  const W = bW(doc);
  drawBorderRect(doc, MARGIN, y, W, rowH, C.headerBg, C.border);
  const colW = W / 4;
  const fields = [
    { label: "Full Name",      value: customer.fullName },
    { label: "Phone",          value: customer.phone || "—" },
    { label: "Address",        value: customer.address || "—" },
    { label: "Account Status", value: (customer.status || "—").toUpperCase() },
  ];
  fields.forEach((f, i) => {
    const cx = MARGIN + i * colW + 10;
    if (i > 0) drawLine(doc, MARGIN + i * colW, y + 8, MARGIN + i * colW, y + rowH - 8, C.border);
    txt(doc, f.label, cx, y + 10, { size: 7, color: C.grey });
    const valColor = f.label === "Account Status" ? statusColor(customer.status) : C.black;
    txt(doc, f.value, cx, y + 24, { size: 9, color: valColor, font: "Helvetica-Bold", width: colW - 14 });
  });
  return y + rowH + 16;
}

// ── Transactions Table ────────────────────────────────────────────────────────
// Total col widths must = bW = ~535
const TRX_COLS_CUSTOMER = [
  { label: "#",        w: 22,  align: "center" },
  { label: "Date",     w: 70,  align: "left"   },
  { label: "Customer", w: 108, align: "left"   },
  { label: "Type",     w: 58,  align: "center" },
  { label: "Amount",   w: 90,  align: "right"  },
  { label: "Note",     w: 132, align: "left"   },
  { label: "Status",   w: 55,  align: "center" },
]; // total: 535

const TRX_COLS_NO_CUSTOMER = [
  { label: "#",           w: 22,  align: "center" },
  { label: "Date & Time", w: 110, align: "left"   },
  { label: "Type",        w: 66,  align: "center" },
  { label: "Amount",      w: 90,  align: "right"  },
  { label: "Note",        w: 192, align: "left"   },
  { label: "Status",      w: 55,  align: "center" },
]; // total: 535

function drawTransactionRows(doc, transactions, cols, y, withCustomer = false) {
  const rowH = 30;
  transactions.forEach((t, i) => {
    if (y + rowH > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      y = drawTableHeader(doc, cols, y);
    }
    const bg = i % 2 === 0 ? C.white : C.lightGrey;
    drawRect(doc, MARGIN, y, bW(doc), rowH, bg);
    drawLine(doc, MARGIN, y + rowH, MARGIN + bW(doc), y + rowH, C.border, 0.3);

    const ttype = (t.type || "").toLowerCase();
    const vc = y + 10;
    let cx = MARGIN;

    txt(doc, String(i + 1), cx + 5, vc, { size: 8, width: cols[0].w - 8, align: "center" }); cx += cols[0].w;

    if (withCustomer) {
      txt(doc, fdate(t.createdAt), cx + 5, vc, { size: 7.5, width: cols[1].w - 8 }); cx += cols[1].w;
      txt(doc, t.customerId?.fullName || "—", cx + 5, vc, { size: 7.5, width: cols[2].w - 8 }); cx += cols[2].w;
      txt(doc, ttype.toUpperCase(), cx + 5, vc, { size: 8, color: typeColor(ttype), font: "Helvetica-Bold", width: cols[3].w - 8, align: "center" }); cx += cols[3].w;
      txt(doc, fc(t.amount), cx + 5, vc, { size: 8, color: typeColor(ttype), font: "Helvetica-Bold", width: cols[4].w - 8, align: "right" }); cx += cols[4].w;
      txt(doc, t.note || "—", cx + 5, vc, { size: 7.5, width: cols[5].w - 10 }); cx += cols[5].w;
      txt(doc, (t.status || "").toUpperCase(), cx + 5, vc, { size: 7, color: statusColor(t.status), font: "Helvetica-Bold", width: cols[6].w - 8, align: "center" });
    } else {
      txt(doc, fdatetime(t.createdAt), cx + 5, vc, { size: 7.5, width: cols[1].w - 8 }); cx += cols[1].w;
      txt(doc, ttype.toUpperCase(), cx + 5, vc, { size: 8, color: typeColor(ttype), font: "Helvetica-Bold", width: cols[2].w - 8, align: "center" }); cx += cols[2].w;
      txt(doc, fc(t.amount), cx + 5, vc, { size: 8, color: typeColor(ttype), font: "Helvetica-Bold", width: cols[3].w - 8, align: "right" }); cx += cols[3].w;
      txt(doc, t.note || "—", cx + 5, vc, { size: 7.5, width: cols[4].w - 10 }); cx += cols[4].w;
      txt(doc, (t.status || "").toUpperCase(), cx + 5, vc, { size: 7, color: statusColor(t.status), font: "Helvetica-Bold", width: cols[5].w - 8, align: "center" });
    }

    y += rowH;
  });
  return y + 16;
}

function drawTransactions(doc, transactions, y, withCustomer = false) {
  const cols = withCustomer ? TRX_COLS_CUSTOMER : TRX_COLS_NO_CUSTOMER;
  y = drawSectionHeader(doc, `TRANSACTION HISTORY  (${transactions.length} records)`, y);
  if (!transactions.length) {
    drawBorderRect(doc, MARGIN, y, bW(doc), 36, C.lightGrey, C.border);
    txt(doc, "No transactions found for this period.", MARGIN, y + 12, { size: 9, color: C.grey, width: bW(doc), align: "center" });
    return y + 36 + 16;
  }
  y = drawTableHeader(doc, cols, y);
  return drawTransactionRows(doc, transactions, cols, y, withCustomer);
}

// ── Loans Table ───────────────────────────────────────────────────────────────
// Total: 535
const LOAN_COLS = [
  { label: "#",        w: 22,  align: "center" },
  { label: "Loan ID",  w: 110, align: "left"   },
  { label: "Amount",   w: 90,  align: "right"  },
  { label: "Interest", w: 65,  align: "center" },
  { label: "Duration", w: 70,  align: "center" },
  { label: "Status",   w: 55,  align: "center" },
  { label: "Date",     w: 123, align: "center" },
]; // total: 535

function drawLoans(doc, loans, y) {
  y = drawSectionHeader(doc, `LOAN RECORDS  (${loans.length} records)`, y);
  if (!loans.length) {
    drawBorderRect(doc, MARGIN, y, bW(doc), 36, C.lightGrey, C.border);
    txt(doc, "No loans found for this period.", MARGIN, y + 12, { size: 9, color: C.grey, width: bW(doc), align: "center" });
    return y + 36 + 16;
  }
  y = drawTableHeader(doc, LOAN_COLS, y);
  const rowH = 30;
  loans.forEach((loan, i) => {
    if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 40; y = drawTableHeader(doc, LOAN_COLS, y); }
    const bg = i % 2 === 0 ? C.white : C.lightGrey;
    drawRect(doc, MARGIN, y, bW(doc), rowH, bg);
    drawLine(doc, MARGIN, y + rowH, MARGIN + bW(doc), y + rowH, C.border, 0.3);
    const vc = y + 10;
    let cx = MARGIN;
    txt(doc, String(i + 1), cx + 5, vc, { size: 8, width: LOAN_COLS[0].w - 8, align: "center" }); cx += LOAN_COLS[0].w;
    txt(doc, loan.publicId || "—", cx + 5, vc, { size: 8, width: LOAN_COLS[1].w - 8 }); cx += LOAN_COLS[1].w;
    txt(doc, fc(loan.amount), cx + 5, vc, { size: 8, color: C.accent, font: "Helvetica-Bold", width: LOAN_COLS[2].w - 8, align: "right" }); cx += LOAN_COLS[2].w;
    txt(doc, `${loan.interest || 0}%`, cx + 5, vc, { size: 8, width: LOAN_COLS[3].w - 8, align: "center" }); cx += LOAN_COLS[3].w;
    txt(doc, `${loan.duration || 0} months`, cx + 5, vc, { size: 8, width: LOAN_COLS[4].w - 8, align: "center" }); cx += LOAN_COLS[4].w;
    txt(doc, (loan.status || "").toUpperCase(), cx + 5, vc, { size: 7, color: statusColor(loan.status), font: "Helvetica-Bold", width: LOAN_COLS[5].w - 8, align: "center" }); cx += LOAN_COLS[5].w;
    txt(doc, fdate(loan.createdAt), cx + 5, vc, { size: 8, width: LOAN_COLS[6].w - 8, align: "center" });
    y += rowH;
  });
  return y + 16;
}


// ── Customer Report ───────────────────────────────────────────────────────────
export async function generateCustomerReport(customerId, user, res, query) {
  const { filter, startDate, endDate } = query;

  const customer = await Customer.findOne({ publicId: customerId });
  if (!customer) throw new AppError("Customer not found", 404);

  if (user.role === "cashier") {
    const isOwner =
      customer.createdBy.toString() === user._id.toString() ||
      (customer.assignedTo && customer.assignedTo.toString() === user._id.toString());
    if (!isOwner) throw new AppError("Not authorized", 403);
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

  const doc = new PDFDocument({ margin: 0, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${customer.publicId}-report.pdf`);
  doc.pipe(res);

  let y = drawBanner(doc,
    [
      { text: "FairColor Bank", size: 22, color: C.white, font: "Helvetica-Bold" },
      { text: "Financial Services & Solutions" },
      { text: `Customer ID: ${customer.publicId}` },
      { text: `Ref: RPT-${Date.now()}`, size: 7 },
    ],
    [
      { text: "CUSTOMER FINANCIAL REPORT", size: 11, color: C.white, font: "Helvetica-Bold" },
      { text: `Period: ${rangeLabel}` },
      { text: `Generated: ${new Date().toLocaleString()}` },
    ]
  );

  y = drawCustomerInfo(doc, customer, y);
  y = drawSummaryCards(doc, balance, y);
  y = drawTransactions(doc, transactions, y, false);
  y = drawLoans(doc, loans, y);
  drawFooter(doc);
  doc.end();
}

// ── Cashier Report ────────────────────────────────────────────────────────────
export async function generateCashierReport(query, adminUser, res) {
  if (adminUser.role !== "admin") throw new AppError("Only admin can generate cashier reports", 403);

  const { cashierId, filter, startDate, endDate } = query;
  const cashier = await User.findOne({ publicId: cashierId });
  if (!cashier) throw new AppError("Cashier not found", 404);

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
    if (t.type === "deposit")    deposits    += t.amount;
    if (t.type === "withdrawal") withdrawals += t.amount;
    if (t.type === "loan")       loans       += t.amount;
  });

  const balance = { deposits, withdrawals, loans, balance: deposits - withdrawals - loans };

  const doc = new PDFDocument({ margin: 0, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${cashier.publicId}-report.pdf`);
  doc.pipe(res);

  let y = drawBanner(doc,
    [
      { text: "FairColor Bank", size: 22, color: C.white, font: "Helvetica-Bold" },
      { text: "Financial Services & Solutions" },
      { text: `Cashier ID: ${cashier.publicId}` },
      { text: `Cashier: ${cashier.fullName}` },
    ],
    [
      { text: "CASHIER FINANCIAL STATEMENT", size: 11, color: C.white, font: "Helvetica-Bold" },
      { text: `Period: ${rangeLabel}` },
      { text: `Generated: ${new Date().toLocaleString()}` },
    ]
  );

  y = drawSummaryCards(doc, balance, y);
  y = drawTransactions(doc, transactions, y, true); // withCustomer = true
  drawFooter(doc);
  doc.end();
}