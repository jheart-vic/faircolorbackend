// scripts/importRepayments.js
//
// Imports the "LOAN REPAYMENT" sheet into MongoDB as Loans, with each loan's
// repayment installments embedded in a `repayments` array on the loan.
//
// Run from the project root:
//   DRY_RUN=1 node scripts/importRepayments.js     # parse + merge + report, write nothing
//   node scripts/importRepayments.js                # the real import
//
// GROUPING RULE (agreed): the sheet splits one loan across multiple "cards" when
// its schedule runs long (a continuation card carries the prior balance forward).
// We MERGE cards that share the same customer + principal into one loan and
// concatenate their installments. This is a heuristic:
//   - It collapses ~458 cards into ~365 loans.
//   - ~18 loans can't yield a sane interest (continuation/partial data); their
//     interest is floored to 0 and tagged in _import.note for you to review.
//   - It can occasionally OVER-merge two genuinely separate same-size loans into
//     one. Those are findable via _import.note / unusually high interest.
//
// Idempotent: re-running upserts on _import.ref, so loans are updated, not duplicated.
//
// PREREQUISITES: npm install xlsx; an admin user (or IMPORT_USER_ID).

import "dotenv/config";
import path from "node:path";
import mongoose from "mongoose";
import xlsx from "xlsx";

import Customer from "../models/Customer.js";
import Loan from "../models/Loan.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { generatePublicId } from "../utils/publicId.js";

const FILE = process.env.FILE || path.resolve("faircolordata.xlsx");
const SHEET = "LOAN REPAYMENT";
const DRY_RUN = process.env.DRY_RUN === "1";

const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

// ── parse ─────────────────────────────────────────────────────────────────────

// Loan meta sits as label/value pairs in the two rows above the "Days" header.
function metaAbove(rows, r, c) {
  const m = {};
  for (const rr of [rows[r - 2] || [], rows[r - 1] || []]) {
    for (let k = c; k < c + 14 && k < rr.length; k++) {
      if (typeof rr[k] !== "string") continue;
      const label = norm(rr[k]);
      const val = rr[k + 1];
      if (label === "Loan Disbursed" && isNum(val)) m.principal = val;
      else if (label === "Total Repayment" && isNum(val)) m.totalRepayment = val;
      else if (label === "Loan Repayment" && isNum(val)) m.perInstallment = val;
      else if (label === "Weekly Payment") { m.weekly = true; if (isNum(val)) m.weeklyPay = val; }
    }
  }
  return m;
}

function parseCards(rows) {
  const cards = [];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] !== "Days") continue;
      const nameRow = rows[r - 1] || [];
      const rawName = nameRow[c];
      if (!rawName || norm(rawName) === "Loan Repayment Update") continue;

      const meta = metaAbove(rows, r, c);
      if (!isNum(meta.principal) || meta.principal < 1) continue; // need a principal

      const reps = [];
      let lastDate = null;
      for (let i = r + 1; i < rows.length; i++) {
        const row = rows[i];
        const days = row[c];
        const dateCell = row[c + 1];
        if (!(isNum(days) || dateCell instanceof Date)) break;
        if (days === "Days") break;
        const date = dateCell instanceof Date ? dateCell : lastDate;
        if (dateCell instanceof Date) lastDate = dateCell;
        const amt = row[c + 2];
        const bal = row[c + 4];
        if (isNum(amt) && amt >= 1) reps.push({ date, amount: amt, balance: isNum(bal) ? bal : null });
      }
      cards.push({
        name: norm(rawName),
        principal: meta.principal,
        totalRepayment: isNum(meta.totalRepayment) ? meta.totalRepayment : null,
        perInstallment: meta.perInstallment || meta.weeklyPay || null,
        weekly: !!meta.weekly,
        reps,
      });
    }
  }
  return cards;
}

// Merge cards sharing (name, principal) into one loan.
function mergeToLoans(cards) {
  const groups = new Map();
  for (const c of cards) {
    const key = c.name.toLowerCase() + "|" + c.principal;
    if (!groups.has(key)) {
      groups.set(key, { name: c.name, principal: c.principal, totals: [], perInstallment: c.perInstallment, weekly: c.weekly, reps: [] });
    }
    const g = groups.get(key);
    if (isNum(c.totalRepayment)) g.totals.push(c.totalRepayment);
    if (!g.perInstallment && c.perInstallment) g.perInstallment = c.perInstallment;
    g.reps.push(...c.reps);
  }

  const loans = [];
  for (const g of groups.values()) {
    g.reps.sort((a, b) => (a.date ? +a.date : 0) - (b.date ? +b.date : 0));
    const paid = g.reps.reduce((s, x) => s + x.amount, 0);
    const lastBal = g.reps.length ? g.reps[g.reps.length - 1].balance : null;
    const recorded = g.totals.length ? Math.max(...g.totals) : 0;
    const amountToPay = Math.max(recorded, paid + (isNum(lastBal) ? Math.max(lastBal, 0) : 0));

    let interest = Math.round(((amountToPay - g.principal) / g.principal) * 100);
    let note;
    if (interest < 0) { interest = 0; note = "interest unverified (continuation/partial data)"; }

    const installments = g.perInstallment ? Math.round(amountToPay / g.perInstallment) : g.reps.length;
    const duration = Math.max(1, g.weekly ? Math.round(installments / 4.33) : installments);
    const status = isNum(lastBal) && lastBal <= 0 ? "completed" : "disbursed";

    loans.push({
      name: g.name,
      ref: `repay:${g.name.toLowerCase()}|${g.principal}`,
      amount: g.principal,
      amountToPay,
      monthlyPayment: g.perInstallment || undefined,
      interest,
      duration,
      repaymentMethod: g.weekly ? "weekly" : "monthly",
      status,
      repayments: g.reps,
      totalRepaid: paid,
      note,
    });
  }
  return loans;
}

// ── store ─────────────────────────────────────────────────────────────────────

const customerCache = new Map(); // lowercased name -> _id
async function customerIdFor(name, userId) {
  const key = name.toLowerCase();
  if (customerCache.has(key)) return customerCache.get(key);
  let c = await Customer.findOne({ fullName: name }).collation({ locale: "en", strength: 2 });
  if (!c) {
    c = await Customer.create({
      publicId: generatePublicId("CUS"),
      fullName: name,
      surname: name.split(" ")[0],
      createdBy: userId,
      status: "approved",
      isApproved: true,
    });
  }
  customerCache.set(key, c._id);
  return c._id;
}

async function run() {
  const wb = xlsx.readFile(FILE, { cellDates: true, cellFormula: false });
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, raw: true, defval: null });
  const cards = parseCards(rows);
  const loans = mergeToLoans(cards);

  const flagged = loans.filter((l) => l.note).length;
  const installments = loans.reduce((s, l) => s + l.repayments.length, 0);
  const repaid = loans.reduce((s, l) => s + l.totalRepaid, 0);

  console.log(`Parsed ${cards.length} cards -> merged into ${loans.length} loans.`);
  console.log(`  installments: ${installments}`);
  console.log(`  total repaid: ₦${repaid.toLocaleString()}`);
  console.log(`  flagged for review (interest floored to 0): ${flagged}`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — nothing written. Sample:");
    loans.slice(0, 10).forEach((l) =>
      console.log(`  ${l.name.padEnd(28)} ₦${l.amount} @ ${l.interest}% ${l.duration}mo  ${l.status}  ${l.repayments.length} pmts${l.note ? "  [review]" : ""}`)
    );
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const importUser = process.env.IMPORT_USER_ID
    ? await User.findById(process.env.IMPORT_USER_ID)
    : await User.findOne({ role: "admin" });
  if (!importUser) throw new Error("No import user found. Set IMPORT_USER_ID or create an admin.");

  let created = 0, updated = 0;
  for (const l of loans) {
    const customerId = await customerIdFor(l.name, importUser._id);
    const res = await Loan.findOneAndUpdate(
      { "_import.ref": l.ref },
      {
        $set: {
          customerId,
          amount: l.amount,
          amountToPay: l.amountToPay,
          monthlyPayment: l.monthlyPayment,
          interest: l.interest,
          duration: l.duration,
          repaymentMethod: l.repaymentMethod,
          status: l.status,
          repayments: l.repayments,
          totalRepaid: l.totalRepaid,
          "_import.source": SHEET,
          "_import.note": l.note,
        },
        $setOnInsert: {
          publicId: generatePublicId("LOAN"),
          createdBy: importUser._id,
          "_import.ref": l.ref,
        },
      },
      { upsert: true, new: false, rawResult: true }
    );
    if (res.lastErrorObject?.updatedExisting) updated++;
    else created++;
  }

  await AuditLog.create({
    action: "IMPORT_REPAYMENTS",
    performedBy: importUser._id,
    meta: { source: SHEET, loans: loans.length, created, updated, installments, flagged },
  });

  console.log("\n──────── SUMMARY ────────");
  console.log(`Loans created:  ${created}`);
  console.log(`Loans updated:  ${updated}`);
  console.log(`Installments:   ${installments}`);
  console.log(`Flagged review: ${flagged}  (find them: Loan.find({ "_import.note": { $ne: null } }))`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});