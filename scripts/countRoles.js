// Prints how many staff accounts currently hold each role.
//
// Usage: node scripts/countRoles.js

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Role from '../models/Role.js'
import User from '../models/User.js'

dotenv.config()

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB\n')

  const roles = await Role.find().sort({ isSystemRole: -1, name: 1 })

  for (const role of roles) {
    const count = await User.countDocuments({ role: role._id })
    console.log(`${role.name.padEnd(20)} ${count}`)
  }

  // Anyone still stuck on the old string-role schema (not yet migrated)
  const staleCount = await mongoose.connection.db
    .collection('users')
    .countDocuments({ role: { $type: 'string' } })

  if (staleCount > 0) {
    console.log(`\n⚠ ${staleCount} user(s) still have an old string role and haven't been migrated yet.`)
    console.log('  Run `npm run migrate:roles` to fix them.')
  }

  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('❌ Failed:', err)
  process.exit(1)
})