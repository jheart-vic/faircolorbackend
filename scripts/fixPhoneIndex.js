// scripts/fixPhoneIndex.js
//
// One-time fix. Replaces the non-sparse unique index on Customer.phone with a
// sparse one, so multiple customers can exist without a phone number.
// You do NOT need mongosh or Compass — just run this once:
//
//   node scripts/fixPhoneIndex.js
//
// Safe to run more than once; it no-ops if the sparse index is already there.

import "dotenv/config";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const coll = Customer.collection;
  const indexes = await coll.indexes();
  const phoneIdx = indexes.find((i) => i.key && i.key.phone === 1);

  if (phoneIdx) {
    if (phoneIdx.sparse) {
      console.log(`Index "${phoneIdx.name}" is already sparse — nothing to do.`);
      await mongoose.disconnect();
      return;
    }
    console.log(`Dropping old index "${phoneIdx.name}" (not sparse)...`);
    await coll.dropIndex(phoneIdx.name);
  } else {
    console.log("No existing phone index found — will just create the sparse one.");
  }

  console.log("Creating sparse unique index on phone...");
  await coll.createIndex({ phone: 1 }, { unique: true, sparse: true, name: "phone_1" });

  console.log("Done. phone index is now unique + sparse.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});