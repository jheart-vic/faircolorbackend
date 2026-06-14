// scripts/importLoans.js
//
// Imports loan records from faircolordata.xlsx (the "TRANSFERS" sheet) into MongoDB.
// Run from the project root:
//
//   node scripts/importLoans.js                 # real import
//   DRY_RUN=1 node scripts/importLoans.js       # parse + report only, write nothing
//   FILE=./faircolordata.xlsx node scripts/importLoans.js
//
// PREREQUISITES
//   1) npm install xlsx
//   2) The Customer model has `phone: { unique: true }` WITHOUT `sparse: true`.
//      These loan rows have no phone number, so creating more than one
//      phone-less customer will throw a duplicate-key error on phone: null.
//      Fix the index ONCE before importing:
//         - In models/Customer.js change phone to:
//              phone: { type: String, unique: true, sparse: true, index: true }
//         - Then in the mongo shell drop the old index so Mongoose can rebuild it:
//              db.customers.dropIndex("phone_1")
//
// This script is idempotent: re-running it will not create duplicate loans.

import "dotenv/config";
import path from "node:path";
import mongoose from "mongoose";
import xlsx from "xlsx";

import Customer from "../models/Customer.js";
import Loan from "../models/Loan.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js"; // registers the User model + used to attribute the import

const FILE = process.env.FILE || path.resolve("faircolordata.xlsx");
const SHEET = "TRANSFERS";
const DRY_RUN = process.env.DRY_RUN === "1";

// ── helpers ────────────────────────────────────────────────────────────────

// "6 Months" -> 6, "Month" -> 1, null -> null
function parseDurationMonths(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const m = String(value).match(/(\d+)/);
  if (m) return Number(m[1]);
  if (/month/i.test(String(value))) return 1;
  return null;
}

// Decide an interest PERCENT (the model stores a percent number, e.g. 24).
// Try, in order: the explicit rate column, the naira interest amount, and
// finally (total repayment - principal), which is interest by definition.
function deriveInterestPercent({ interestRate, interestAmount, loanAmount, amountToPay }) {
  if (typeof interestRate === "number") {
    // 0.24 in the sheet means 24%
    return interestRate <= 1 ? Math.round(interestRate * 100) : Math.round(interestRate);
  }
  if (typeof interestAmount === "number" && typeof loanAmount === "number" && loanAmount > 0) {
    return Math.round((interestAmount / loanAmount) * 100);
  }
  if (typeof amountToPay === "number" && typeof loanAmount === "number" && loanAmount > 0 && amountToPay > loanAmount) {
    return Math.round(((amountToPay - loanAmount) / loanAmount) * 100);
  }
  return null;
}

function normalizeName(name) {
  return String(name).replace(/\s+/g, " ").trim();
}

// ── read step ────────────────────────────────────────────────────────────────

function readLoanRows() {
  const wb = xlsx.readFile(FILE, {
    cellDates: true, // Excel date serials -> JS Date
    cellFormula: false, // give us computed values, not "=C4-D4" strings
  });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet "${SHEET}" not found in ${FILE}`);

  // header:1 -> rows as arrays. Row 0 is the header; data starts at row 1.
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  // This sheet is a human ledger: real loan records sit at the top, and other
  // mini-tables (repayment schedules with "Days", 1, 2, 3 ...) are stacked below.
  // A real record = a name in col A AND a numeric loan amount >= 1 in col B.
  // That single rule cleanly separates the signal from the noise.
  return rows
    .slice(1)
    .filter((r) => r[0] && typeof r[1] === "number" && r[1] >= 1)
    .map((r) => ({
      name: normalizeName(r[0]),
      loanAmount: r[1],
      interestAmount: typeof r[2] === "number" ? r[2] : null, // naira interest
      disbursementDate: r[3] instanceof Date ? r[3] : null,
      durationMonths: parseDurationMonths(r[4]),
      // col 5 is a blank spacer column in this sheet
      maturityDate: r[6] instanceof Date ? r[6] : null,
      amountToPay: typeof r[7] === "number" ? r[7] : null,
      installment: typeof r[8] === "number" ? r[8] : null,
      frequency: typeof r[9] === "string" ? r[9].toLowerCase() : null, // "weekly" etc.
      interestRate: typeof r[10] === "number" ? r[10] : null,
      deposit: typeof r[11] === "number" ? r[11] : null, // upfront deposit / collateral
      formInsurance: typeof r[12] === "number" ? r[12] : null,
    }));
}

// ── store step ────────────────────────────────────────────────────────────────

async function findOrCreateCustomer(name, userId) {
  // Match on fullName (case-insensitive, exact). These rows carry no phone,
  // so name is the only key we have — accept that it is imperfect.
  const existing = await Customer.findOne({
    fullName: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  });
  if (existing) return { customer: existing, created: false };

  const customer = await Customer.create({
    fullName: name,
    surname: name.split(" ")[0],
    createdBy: userId,
    status: "approved", // historical records — already real customers
    isApproved: true,
    // NOTE: no phone. Requires the sparse index fix described in the header.
  });
  return { customer, created: true };
}

async function importLoans() {
  const records = readLoanRows();
  console.log(`Parsed ${records.length} loan record(s) from "${SHEET}".`);

  // Attribute the import to a real user. Pass IMPORT_USER_ID, or we grab an admin.
  let importUser;
  if (process.env.IMPORT_USER_ID) {
    importUser = await User.findById(process.env.IMPORT_USER_ID);
  } else {
    importUser = await User.findOne({ role: "admin" });
  }
  if (!importUser) throw new Error("No import user found. Set IMPORT_USER_ID or create an admin.");

  const report = { created: 0, updated: 0, skipped: 0, customersCreated: 0, warnings: [] };

  for (const rec of records) {
    const interest = deriveInterestPercent(rec);
    const duration = rec.durationMonths;

    // Loan model requires amount, interest, duration. Skip what we can't honor,
    // but record why so a human can fix the sheet and re-run.
    if (interest == null || duration == null) {
      report.skipped++;
      report.warnings.push(
        `Skipped "${rec.name}" (amount ${rec.loanAmount}): missing ${interest == null ? "interest" : ""} ${duration == null ? "duration" : ""}`.trim()
      );
      continue;
    }

    const { customer, created } = DRY_RUN
      ? { customer: { _id: "dryrun", fullName: rec.name }, created: true }
      : await findOrCreateCustomer(rec.name, importUser._id);
    if (created) report.customersCreated++;

    // Fields that were previously dropped — now captured. undefined values are
    // simply not written, so partial rows stay clean.
    const extraFields = {
      disbursementDate: rec.disbursementDate ?? undefined,
      maturityDate: rec.maturityDate ?? undefined,
      interestAmount: rec.interestAmount ?? undefined,
      deposit: rec.deposit ?? undefined,
      formInsurance: rec.formInsurance ?? undefined,
    };

    // Idempotency: if this loan already exists, backfill the new fields onto it
    // (so the loans imported before these fields existed get updated) rather
    // than skipping. Otherwise create it fresh.
    if (!DRY_RUN) {
      const existing = await Loan.findOne({
        customerId: customer._id,
        amount: rec.loanAmount,
      });
      if (existing) {
        await Loan.updateOne({ _id: existing._id }, { $set: extraFields });
        report.updated++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(
        `WOULD IMPORT  ${rec.name.padEnd(34)} amount=${rec.loanAmount} interest=${interest}% duration=${duration}mo ` +
          `disbursed=${rec.disbursementDate ? rec.disbursementDate.toISOString().slice(0, 10) : "-"} deposit=${rec.deposit ?? "-"}`
      );
      report.created++;
      continue;
    }

    const loan = await Loan.create({
      customerId: customer._id,
      amount: rec.loanAmount,
      interest,
      duration,
      amountToPay: rec.amountToPay ?? undefined,
      monthlyPayment: rec.installment ?? undefined,
      repaymentMethod: ["daily", "weekly", "monthly", "quarterly"].includes(rec.frequency)
        ? rec.frequency
        : "monthly",
      status: "disbursed",
      createdBy: importUser._id,
      ...extraFields,
    });

    await AuditLog.create({
      action: "IMPORT_LOAN",
      performedBy: importUser._id,
      targetId: loan._id,
      meta: { source: "faircolordata.xlsx", sheet: SHEET, disbursementDate: rec.disbursementDate },
    });

    report.created++;
  }

  return report;
}

// ── runner ────────────────────────────────────────────────────────────────────

async function main() {
  if (!DRY_RUN) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  }

  const report = await importLoans();

  console.log("\n──────── SUMMARY ────────");
  console.log(`Loans ${DRY_RUN ? "to import" : "imported"}: ${report.created}`);
  console.log(`Existing loans backfilled: ${report.updated}`);
  console.log(`Skipped:               ${report.skipped}`);
  console.log(`Customers created:     ${report.customersCreated}`);
  if (report.warnings.length) {
    console.log("\nWarnings:");
    report.warnings.forEach((w) => console.log("  - " + w));
  }

  if (!DRY_RUN) await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});