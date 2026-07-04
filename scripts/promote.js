// One-off helper: promotes an existing user to Super Admin by email.
// Useful right after `migrate:roles`, when a pre-existing account (e.g. the
// old bootstrap "admin" account) needs to become the first Super Admin.
//
// Usage: node scripts/promoteToSuperAdmin.js someone@example.com

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Role from '../models/Role.js'
import User from '../models/User.js'

dotenv.config()

async function run() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node scripts/promoteToSuperAdmin.js someone@example.com')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const superAdminRole = await Role.findOne({ slug: 'super_admin' })
  if (!superAdminRole) {
    console.error('Super Admin role not found — run `npm run seed` first.')
    await mongoose.disconnect()
    process.exit(1)
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() })
  if (!user) {
    console.error(`No user found with email "${email}".`)
    await mongoose.disconnect()
    process.exit(1)
  }

  user.role = superAdminRole._id
  await user.save()

  console.log(`✔ ${user.email} (${user.publicId}) is now Super Admin.`)

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('❌ Promotion failed:', err)
  process.exit(1)
})