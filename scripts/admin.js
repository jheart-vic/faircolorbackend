// Seeds the four system roles (Super Admin, Admin, Account Manager, Cashier)
// and, if no Super Admin exists yet, creates a bootstrap Super Admin account
// from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
//
// Safe to run repeatedly: existing roles are updated in place (permissions
// only — name/slug are left untouched once created) and the bootstrap admin
// is only created once.
//
// Usage: npm run seed

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Role from '../models/Role.js'
import User from '../models/User.js'
import { SYSTEM_ROLES } from '../utils/permissions.js'

dotenv.config()

async function seed() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log('Connected to MongoDB')

  const rolesBySlug = {}

  for (const def of SYSTEM_ROLES) {
    const role = await Role.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: {
          name: def.name,
          description: def.description,
          prefix: def.prefix,
          permissions: def.permissions,
          isSystemRole: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    rolesBySlug[def.slug] = role
    console.log(`✔ Role ready: ${role.name} (${role.permissions.length} permissions)`)
  }

  const existingSuperAdmin = await User.findOne({ role: rolesBySlug.super_admin._id })

  if (existingSuperAdmin) {
    console.log('Super Admin already exists, skipping bootstrap user creation')
  } else {
    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD

    if (!email || !password) {
      console.warn(
        'No Super Admin exists and ADMIN_EMAIL/ADMIN_PASSWORD are not set — skipping bootstrap user. Set them in .env and rerun `npm run seed`.',
      )
    } else {
      // A user with this email may already exist from BEFORE the role
      // rewrite, still holding the old string role (e.g. "admin"). That's
      // not a duplicate account to create — it's an account that needs
      // migrating. Detect it by email (not by the new role reference) so we
      // don't crash with an E11000 duplicate-key error.
      const existingByEmail = await User.findOne({ email: email.toLowerCase().trim() })

      if (existingByEmail) {
        console.warn(
          `A user with email "${email}" already exists but isn't linked to the Super Admin role yet.\n` +
            'This is almost always a pre-migration account. Run `npm run migrate:roles` next — ' +
            'it will convert that account\'s old string role into a proper Super Admin reference.',
        )
      } else {
        const superAdmin = await User.create({
          fullName: 'Super Admin',
          email: email.toLowerCase().trim(),
          password,
          role: rolesBySlug.super_admin._id,
        })
        console.log(`✔ Bootstrap Super Admin created: ${superAdmin.email} (${superAdmin.publicId})`)
      }
    }
  }

  await mongoose.disconnect()
  console.log('Done')
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})