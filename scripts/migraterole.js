// One-time migration: converts users created under the old schema (where
// `role` was stored as a plain string like "admin", "Super Admin", "Cashier",
// etc.) into references to the new Role collection.
//
// This MUST be run against the live database before/after deploying the new
// role-based-access code — the new User schema expects `role` to be an
// ObjectId, so any user still holding a plain string will fail to log in
// with a Mongoose "Cast to ObjectId failed ... at path 'role'" error.
//
// Safe to run repeatedly — users that already hold a valid ObjectId role
// reference are left untouched.
//
// Usage: npm run seed && npm run migrate:roles

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Role from '../models/Role.js'
import { SYSTEM_ROLE_SLUGS } from '../utils/permissions.js'

dotenv.config()

// Maps every legacy string variant we might encounter (any casing/spacing)
// to the correct system role slug.
const LEGACY_ALIASES = {
  superadmin: 'super_admin',
  'super admin': 'super_admin',
  'super_admin': 'super_admin',
  admin: 'admin',
  accountmanager: 'account_manager',
  'account manager': 'account_manager',
  'account_manager': 'account_manager',
  cashier: 'cashier',
}

function resolveSlug(rawValue) {
  const normalized = String(rawValue).trim().toLowerCase()
  return LEGACY_ALIASES[normalized] || null
}

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const roles = await Role.find({ slug: { $in: SYSTEM_ROLE_SLUGS } })
  const roleIdBySlug = Object.fromEntries(roles.map((r) => [r.slug, r._id]))

  if (!roles.length) {
    console.warn('No system roles found — run `npm run seed` first, then rerun this script.')
    await mongoose.disconnect()
    return
  }

  const usersCollection = mongoose.connection.db.collection('users')

  // Any user whose `role` field is a string (old schema) rather than an
  // ObjectId (new schema) needs fixing.
  const staleUsers = await usersCollection
    .find({ role: { $type: 'string' } })
    .toArray()

  if (!staleUsers.length) {
    console.log('Nothing to migrate — every user already has a Role reference.')
    await mongoose.disconnect()
    return
  }

  let migrated = 0
  const unresolved = []

  for (const user of staleUsers) {
    const slug = resolveSlug(user.role)
    const roleId = slug && roleIdBySlug[slug]

    if (!roleId) {
      unresolved.push({ email: user.email, role: user.role })
      continue
    }

    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { role: roleId } },
    )
    migrated++
    console.log(`✔ ${user.email}: "${user.role}" → ${slug}`)
  }

  console.log(`\nDone — ${migrated} user(s) migrated.`)

  if (unresolved.length) {
    console.warn(
      `\n⚠ ${unresolved.length} user(s) had a role value that couldn't be matched and were left as-is (they will not be able to log in until fixed manually):`,
    )
    unresolved.forEach((u) => console.warn(`   - ${u.email}: "${u.role}"`))
    console.warn(
      '\nFix these directly in the database, or via /api/roles/users/:userId/assign once you can log in as another Super Admin.',
    )
  }

  await mongoose.disconnect()
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})