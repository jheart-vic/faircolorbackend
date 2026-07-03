// ── Permission catalog ──────────────────────────────────────────────────────
// Single source of truth for every capability in the system. Roles (see
// models/Role.js) are just named bundles of these permission strings, which
// means new roles can be created at runtime without touching this file.

export const PERMISSIONS = Object.freeze({
  // Customers
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_VIEW_OWN: 'customers.view.own', // created by / assigned to the actor
  CUSTOMERS_VIEW_ALL: 'customers.view.all',
  CUSTOMERS_APPROVE: 'customers.approve',
  CUSTOMERS_MANAGE: 'customers.manage', // update profile, transfer, deactivate
  CUSTOMERS_DELETE: 'customers.delete',
  CUSTOMERS_REVERT: 'customers.revert', // revert an approved customer back to pending

  // Transactions (deposits & withdrawals)
  TRANSACTIONS_CREATE: 'transactions.create',
  TRANSACTIONS_VIEW_OWN: 'transactions.view.own',
  TRANSACTIONS_VIEW_ALL: 'transactions.view.all',
  TRANSACTIONS_APPROVE_TIER1: 'transactions.approve.tier1', // <= threshold
  TRANSACTIONS_APPROVE_TIER2: 'transactions.approve.tier2', // > threshold

  // Loans
  LOANS_CREATE: 'loans.create',
  LOANS_REVIEW: 'loans.review', // recommend / flag before approval
  LOANS_APPROVE_TIER1: 'loans.approve.tier1',
  LOANS_APPROVE_TIER2: 'loans.approve.tier2',
  LOANS_CREDIT_ANALYSIS: 'loans.credit_analysis',
  LOANS_VIEW_ALL: 'loans.view.all',
  LOANS_REVERT: 'loans.revert', // revert an approved/rejected loan back to pending

  // Reports
  REPORTS_GENERATE_OWN: 'reports.generate.own',
  REPORTS_GENERATE_ALL: 'reports.generate.all',

  // Staff / user administration
  USERS_MANAGE_STAFF: 'users.manage.staff', // create/manage account managers & cashiers
  USERS_MANAGE_ALL: 'users.manage.all', // create/manage any staff, including admins

  // Roles & permissions
  ROLES_MANAGE: 'roles.manage', // create/edit/delete custom roles
  ROLES_ASSIGN: 'roles.assign', // change which role a user has

  // System / oversight
  SYSTEM_CONFIGURE: 'system.configure',
  AUDIT_VIEW: 'audit.view',
})

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS))

// ── Approval threshold ──────────────────────────────────────────────────────
// Admin (tier1) approves transactions/loans at or below this amount.
// Super Admin (tier2) approves everything above it. Applies uniformly to
// deposits, withdrawals, and loan disbursements per the MVP's transaction
// approval workflow.
export const APPROVAL_THRESHOLD = 200000

export function approvalTierFor(amount) {
  return Number(amount) > APPROVAL_THRESHOLD ? 'tier2' : 'tier1'
}

export function approvalPermissionFor(amount, domain = 'transactions') {
  const tier = approvalTierFor(amount)
  return domain === 'loans'
    ? tier === 'tier2'
      ? PERMISSIONS.LOANS_APPROVE_TIER2
      : PERMISSIONS.LOANS_APPROVE_TIER1
    : tier === 'tier2'
      ? PERMISSIONS.TRANSACTIONS_APPROVE_TIER2
      : PERMISSIONS.TRANSACTIONS_APPROVE_TIER1
}

// ── System (bootstrap) roles ────────────────────────────────────────────────
// These four map directly to the MVP's documented roles. They are seeded on
// first run (see scripts/seedRoles.js) and flagged isSystemRole so they can't
// be deleted and can only be edited by a Super Admin. Admin and Super Admin
// can still create additional custom roles at runtime on top of these.
export const SYSTEM_ROLES = Object.freeze([
  {
    slug: 'super_admin',
    name: 'Super Admin',
    description:
      'Full system access. Configures the system, manages all staff and roles, and approves all transactions and loans above the tier-1 threshold.',
    prefix: 'SADM',
    permissions: [
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_VIEW_ALL,
      PERMISSIONS.CUSTOMERS_APPROVE,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.CUSTOMERS_DELETE,
      PERMISSIONS.CUSTOMERS_REVERT,
      PERMISSIONS.TRANSACTIONS_CREATE,
      PERMISSIONS.TRANSACTIONS_VIEW_ALL,
      PERMISSIONS.TRANSACTIONS_APPROVE_TIER1,
      PERMISSIONS.TRANSACTIONS_APPROVE_TIER2,
      PERMISSIONS.LOANS_CREATE,
      PERMISSIONS.LOANS_REVIEW,
      PERMISSIONS.LOANS_APPROVE_TIER1,
      PERMISSIONS.LOANS_APPROVE_TIER2,
      PERMISSIONS.LOANS_CREDIT_ANALYSIS,
      PERMISSIONS.LOANS_VIEW_ALL,
      PERMISSIONS.LOANS_REVERT,
      PERMISSIONS.REPORTS_GENERATE_ALL,
      PERMISSIONS.USERS_MANAGE_STAFF,
      PERMISSIONS.USERS_MANAGE_ALL,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.ROLES_ASSIGN,
      PERMISSIONS.SYSTEM_CONFIGURE,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
  {
    slug: 'admin',
    name: 'Admin',
    description:
      'Approves customer registrations, loans, and transactions up to the tier-1 threshold. Manages customers, staff, and reports; may create and assign roles (excluding Super Admin).',
    prefix: 'ADM',
    permissions: [
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_VIEW_ALL,
      PERMISSIONS.CUSTOMERS_APPROVE,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.TRANSACTIONS_CREATE,
      PERMISSIONS.TRANSACTIONS_VIEW_ALL,
      PERMISSIONS.TRANSACTIONS_APPROVE_TIER1,
      PERMISSIONS.LOANS_CREATE,
      PERMISSIONS.LOANS_REVIEW,
      PERMISSIONS.LOANS_APPROVE_TIER1,
      PERMISSIONS.LOANS_CREDIT_ANALYSIS,
      PERMISSIONS.LOANS_VIEW_ALL,
      PERMISSIONS.REPORTS_GENERATE_ALL,
      PERMISSIONS.USERS_MANAGE_STAFF,
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.ROLES_ASSIGN,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
  {
    slug: 'account_manager',
    name: 'Account Manager',
    description:
      'Manages assigned customers, monitors their accounts, reviews and recommends loan applications, and generates customer reports.',
    prefix: 'ACM',
    permissions: [
      PERMISSIONS.CUSTOMERS_VIEW_OWN,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.TRANSACTIONS_VIEW_OWN,
      PERMISSIONS.LOANS_REVIEW,
      PERMISSIONS.LOANS_VIEW_ALL,
      PERMISSIONS.REPORTS_GENERATE_OWN,
    ],
  },
  {
    slug: 'cashier',
    name: 'Cashier',
    description:
      'Registers customers and processes deposits, withdrawals, and loan applications for their own customers.',
    prefix: 'CASH',
    permissions: [
      PERMISSIONS.CUSTOMERS_CREATE,
      PERMISSIONS.CUSTOMERS_VIEW_OWN,
      PERMISSIONS.TRANSACTIONS_CREATE,
      PERMISSIONS.TRANSACTIONS_VIEW_OWN,
      PERMISSIONS.LOANS_CREATE,
      PERMISSIONS.REPORTS_GENERATE_OWN,
    ],
  },
])

export const SYSTEM_ROLE_SLUGS = Object.freeze(SYSTEM_ROLES.map((r) => r.slug))
