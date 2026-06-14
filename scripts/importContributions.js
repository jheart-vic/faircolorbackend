// scripts/importContributions.js
//
// Imports the "contribution card" sheets (deposit / withdrawal history) into
// MongoDB as Customers + Transactions.
//
// Sheets handled: ALL CUSTOMERS, BARIGA CUSTOMER, ARENA CUSTOMER, Safieu Muritala
//
// Run from the project root:
//   DRY_RUN=1 node scripts/importContributions.js     # parse + report, write nothing
//   node scripts/importContributions.js                # the real import
//   FORCE=1 node scripts/importContributions.js        # re-run after a prior import
//
// PREREQUISITES (same as the loan import):
//   1) npm install xlsx
//   2) Customer.phone must be a SPARSE unique index — run scripts/fixPhoneIndex.js once.
//   3) An admin user must exist (npm run seed), or pass IMPORT_USER_ID.
//
// DECISIONS baked in (see the chat notes):
//   - Withdrawals come ONLY from the cards. The separate WITHDRAWALS sheet records
//     the same events and would double-count, so it is NOT imported here.
//   - LOAN REPAYMENT is excluded: your Transaction enum has no "repayment" type.
//   - Each transaction's createdAt is set to its real date from the sheet, so your
//     existing date filters and balance math (which key off createdAt + status:approved)
//     work over the full history. Status is "approved".
//   - The ~1.7% of rows with no derivable date are still imported, tagged
//     note:"import:card:undated", with createdAt = import time so you can find/fix them.

import "dotenv/config";
import path from "node:path";
import mongoose from "mongoose";
import xlsx from "xlsx";

import Customer from "../models/Customer.js";
import Transaction from "../models/Transaction.js";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";
import { generatePublicId } from "../utils/publicId.js";

const FILE = process.env.FILE || path.resolve("faircolordata.xlsx");
const DRY_RUN = process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1";
const CARD_SHEETS = ["ALL CUSTOMERS", "BARIGA CUSTOMER", "ARENA CUSTOMER", "Safieu Muritala"];
const BATCH = 5000;

const MONTHS = { january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const TX_PREFIX = { deposit: "DEP", withdrawal: "WDL" };

// ── parse ─────────────────────────────────────────────────────────────────────

// Find a card's month from its name row (year + month name may sit at any offset).
function cardMonthDate(nameRow) {
  let year = null, month = null;
  for (const cell of nameRow) {
    if (isNum(cell) && cell >= 2018 && cell <= 2027) year = cell;
    if (typeof cell === "string") {
      const k = cell.trim().toLowerCase();
      if (k in MONTHS) month = MONTHS[k];
    }
  }
  return year != null && month != null ? new Date(year, month, 1) : null;
}

function parseCardSheet(rows) {
  const txns = [];
  // Cards are found by their "Days" header cell — robust to the drifting column
  // offsets in this workbook. A card occupies columns c..c+6 from that cell.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== "Days") continue;
      const nameRow = rows[r - 1] || [];
      const rawName = nameRow[c];
      if (!rawName || norm(rawName) === "DAILY CONTRIBUTION CARD") continue;

      const name = norm(rawName);
      const fallback = cardMonthDate(nameRow);
      let lastDate = null;

      for (let i = r + 1; i < rows.length; i++) {
        const dr = rows[i];
        const daysCell = dr[c];
        const dateCell = dr[c + 1];
        if (!(isNum(daysCell) || dateCell instanceof Date)) break; // end of card
        if (daysCell === "Days") break;

        const date = dateCell instanceof Date ? dateCell : lastDate || fallback;
        if (dateCell instanceof Date) lastDate = dateCell;

        const dep = dr[c + 2];
        const wd = dr[c + 3];
        if (isNum(dep) && dep >= 1) txns.push({ name, type: "deposit", amount: dep, date });
        if (isNum(wd) && wd >= 1) txns.push({ name, type: "withdrawal", amount: wd, date });
      }
    }
  }
  return txns;
}

function parseAll() {
  const wb = xlsx.readFile(FILE, { cellDates: true, cellFormula: false });
  let txns = [];
  for (const name of CARD_SHEETS) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    txns = txns.concat(parseCardSheet(rows));
  }
  return txns;
}

// ── store ─────────────────────────────────────────────────────────────────────

async function ensureCustomers(names, userId) {
  // names: array of canonical display names (deduped, case-insensitive)
  const map = new Map(); // lowercased name -> _id

  // Existing customers (any of these names already in the DB)
  const existing = await Customer.find(
    { fullName: { $in: names } },
    { _id: 1, fullName: 1 }
  ).collation({ locale: "en", strength: 2 }); // case-insensitive match
  for (const c of existing) map.set(c.fullName.toLowerCase(), c._id);

  // Create the missing ones
  const toCreate = names
    .filter((n) => !map.has(n.toLowerCase()))
    .map((n) => ({
      publicId: generatePublicId("CUS"),
      fullName: n,
      surname: n.split(" ")[0],
      createdBy: userId,
      status: "approved",
      isApproved: true,
    }));

  if (toCreate.length) {
    const created = await Customer.insertMany(toCreate, { ordered: false });
    for (const c of created) map.set(c.fullName.toLowerCase(), c._id);
  }
  return { map, createdCount: toCreate.length };
}

async function insertTransactions(txns, nameToId, userId) {
  let counter = 0;
  let inserted = 0;
  let batch = [];

  const flush = async () => {
    if (!batch.length) return;
    await Transaction.collection.insertMany(batch, { ordered: false });
    inserted += batch.length;
    batch = [];
  };

  for (const t of txns) {
    const customerId = nameToId.get(t.name.toLowerCase());
    if (!customerId) continue; // should not happen
    const now = new Date();
    const when = t.date instanceof Date ? t.date : now;
    batch.push({
      type: t.type,
      amount: t.amount,
      customerId,
      cashierId: userId,
      // counter suffix guarantees uniqueness across 160k+ ids
      publicId: `${generatePublicId(`TRX-${TX_PREFIX[t.type]}`)}-${counter++}`,
      status: "approved",
      note: t.date ? "import:card" : "import:card:undated",
      createdAt: when,
      updatedAt: when,
    });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return inserted;
}

// ── runner ──────────────────────────────────────────────────────────────────

async function main() {
  const txns = parseAll();
  const deposits = txns.filter((t) => t.type === "deposit");
  const withdrawals = txns.filter((t) => t.type === "withdrawal");
  const undated = txns.filter((t) => !t.date).length;
  const uniqueNames = [...new Map(txns.map((t) => [t.name.toLowerCase(), t.name])).values()];
  const naira = (a) => a.reduce((s, t) => s + t.amount, 0);

  console.log(`Parsed ${txns.length} transactions for ${uniqueNames.length} customers.`);
  console.log(`  deposits:    ${deposits.length}  (₦${naira(deposits).toLocaleString()})`);
  console.log(`  withdrawals: ${withdrawals.length}  (₦${naira(withdrawals).toLocaleString()})`);
  console.log(`  undated (createdAt = now, tagged): ${undated}`);

  if (DRY_RUN) {
    console.log("\nDRY RUN — nothing written.");
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // Idempotency guard: refuse to run twice unless FORCE=1.
  const already = await Transaction.countDocuments({ note: /^import:card/ });
  if (already > 0 && !FORCE) {
    console.log(`\n${already} card transactions are already imported. Re-run with FORCE=1 to add again.`);
    await mongoose.disconnect();
    return;
  }

  const importUser = process.env.IMPORT_USER_ID
    ? await User.findById(process.env.IMPORT_USER_ID)
    : await User.findOne({ role: "admin" });
  if (!importUser) throw new Error("No import user found. Set IMPORT_USER_ID or create an admin.");

  const { map, createdCount } = await ensureCustomers(uniqueNames, importUser._id);
  console.log(`Customers: ${createdCount} created, ${uniqueNames.length - createdCount} already existed.`);

  const inserted = await insertTransactions(txns, map, importUser._id);

  await AuditLog.create({
    action: "IMPORT_CONTRIBUTIONS",
    performedBy: importUser._id,
    meta: { source: "faircolordata.xlsx", sheets: CARD_SHEETS, customers: createdCount, transactions: inserted },
  });

  console.log("\n──────── SUMMARY ────────");
  console.log(`Customers created:   ${createdCount}`);
  console.log(`Transactions stored: ${inserted}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});