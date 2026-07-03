# Session Context — Fair Colours MFB Backend

> Purpose: give an AI coding agent full situational awareness of this codebase
> in one read, structured by feature/domain rather than by file tree.
> Update this file whenever a feature's behavior, permissions, or endpoints change.

---

## 1. What this app is

A digital ledger / core banking API for **Fair Colours Microfinance Bank**
(Nigeria). Node.js + Express 5 + MongoDB (Mongoose), ESM (`"type": "module"`).
Covers: staff/role management, customer onboarding, deposits/withdrawals,
loans, dashboards, PDF/JSON reports, and in-app notifications.

Entry point: `index.js`. Everything is mounted under `/api` (see `routes/index.js`).
Swagger docs served at `/docs` (JSDoc comments live inline in each route file,
compiled by `swagger/swagger.js`).

Out of scope for this MVP (per README "Next-phase"): PWA/mobile apps,
SMS/email delivery of notifications, multi-branch support, biometric login,
accounting integration, analytics dashboards.

---

## 2. Architecture pattern

Layered, consistently applied across every feature:

```
routes/*.js        → Express routers. Own the Swagger/JSDoc API docs,
                      `protect` (auth) + `requirePermission` (authz) wiring.
controllers/*.js    → Thin HTTP layer: parse req, call service, shape res.
services/*.js       → Business logic, Mongoose queries, cross-model rules.
models/*.js         → Mongoose schemas, hooks (pre-save/validate), virtuals.
middlewares/        → auth.js (JWT), permission.js (RBAC), errorHandler.js
utils/               → Shared helpers (permissions catalog, tokens, ids, etc.)
```

Naming convention: `routes/x.js` → `controllers/xController.js` →
`services/xService.js` → `models/X.js`. Follow this when adding a new feature.

---

## 3. Auth & Identity

**Files:** `controllers/authController.js`, `services/authService.js`,
`middlewares/auth.js`, `utils/token.js`, `models/User.js`

- JWT-based. **Access token** (15 min, `JWT_SECRET`) is set as an httpOnly
  cookie (`accessToken`) AND can be sent as `Authorization: Bearer <token>`.
  **Refresh token** (7 days, random hex via crypto, stored hashed-free on
  the `User` doc) is set as an httpOnly cookie scoped to `/api/auth`.
- `middlewares/auth.js`'s `protect` middleware reads the token from cookie
  first, then `Authorization` header; verifies, loads `User` (populated
  with `role`), and rejects if inactive / missing role / bad token.
- Endpoints: `POST /api/auth/login`, `/refresh`, `/logout` (see `routes/auth.js`).
- Passwords hashed with bcryptjs in a `User` pre-save hook.
- `User.publicId` is auto-generated on save from the assigned role's
  `prefix` (e.g. `ADM-XXXXXXX`) via `utils/publicId.js`.

---

## 4. Roles & Permissions (RBAC) — core design decision

**Files:** `models/Role.js`, `utils/permissions.js`, `controllers/roleController.js`,
`services/roleService.js`, `routes/role.js`, `middlewares/permission.js`

- **Roles are data, not hardcoded strings.** A `Role` document = a name +
  slug + list of permission strings. `utils/permissions.js` is the single
  source of truth for every valid permission string (`PERMISSIONS` const)
  and defines the 4 **system roles** seeded on first run: `super_admin`,
  `admin`, `account_manager`, `cashier` (see `SYSTEM_ROLES`).
- System roles can't be deleted; only Super Admin can edit their permissions.
  Admin/Super Admin can create arbitrary **custom roles** at runtime via
  `POST /api/roles` — no code change needed.
- Authorization rule enforced in service layer: an actor can never grant/assign
  a permission or role they don't themselves hold beyond their own level.
- `middlewares/permission.js` exposes three guards used on routes:
  - `requirePermission(...perms)` — ANY of the listed perms.
  - `requireAllPermissions(...perms)` — ALL of the listed perms.
  - `requireRoleSlug(...slugs)` — literal role slug check (rare; reserved
    for protecting the Super Admin bootstrap role itself).
- **Approval tiers**: `APPROVAL_THRESHOLD = ₦200,000` in `utils/permissions.js`.
  `approvalPermissionFor(amount, domain)` picks `tier1` (Admin, ≤ threshold)
  or `tier2` (Super Admin, > threshold) permission for both `transactions`
  and `loans` domains. This is THE place to change the threshold.

| Role | Slug | Prefix | Summary |
|---|---|---|---|
| Super Admin | `super_admin` | SADM | Full access, all approvals, role/system config |
| Admin | `admin` | ADM | Approves ≤ threshold, manages staff/customers/roles (not Super Admin) |
| Account Manager | `account_manager` | ACM | Manages assigned customers, recommends loans (advisory, not approval) |
| Cashier | `cashier` | CASH | Registers customers, creates deposits/withdrawals/loans (submits only) |

---

## 5. Customers

**Files:** `models/Customer.js`, `controllers/customerController.js`,
`services/customerService.js`, `routes/customer.js`

- Full KYC-style schema: identity, contact, employment, bank details,
  next-of-kin, emergency contact (see model for full field list).
- Lifecycle: `status: pending → approved`. `isDeactivated` for soft-disable,
  hard `delete` reserved for `CUSTOMERS_DELETE` (Super Admin).
- `CUSTOMERS_REVERT` lets a Super Admin roll an approved customer back to pending.
- Ownership model: `createdBy` (who registered them) and `assignedTo`
  (staff responsible, e.g. Account Manager). Non-`CUSTOMERS_VIEW_ALL` roles
  only see customers they created or are assigned to.
- `publicId` prefix: `CUS-`. `fullName` auto-derived from `surname` + `otherName`
  if not explicitly set (pre-validate hook).
- Deleting a customer cascades: deletes their `Transaction`s, `Loan`s, and
  `AuditLog`s (pre-`deleteOne` hook).
- Endpoints: `GET/POST /api/customers`, `PATCH /:id/approve`, `/:id/revert`,
  `/:id/toggle-deactivate`, `DELETE /:id/delete`, `GET /:id/balance`.

---

## 6. Transactions (Deposits & Withdrawals)

**Files:** `models/Transaction.js`, `controllers/transactionController.js`,
`services/transactionService.js`, `routes/transaction.js`

- `type`: `deposit | withdrawal | loan` (loan-type transactions are created
  by the loan approval flow, not directly). `status`: `pending | approved | rejected`.
- Any role with `transactions.create` (Cashier by default) submits; approval
  requires `transactions.approve.tier1` (≤₦200k) or `.tier2` (>₦200k) per
  `utils/permissions.js`'s `approvalPermissionFor`.
- `publicId` prefixed `TRX-DEP-`, `TRX-WDL-`, `TRX-LOAN-` depending on type.
- Non-`TRANSACTIONS_VIEW_ALL` roles see only their own submitted transactions.
- Endpoints: `POST /deposit`, `POST /withdraw`, `PATCH /:id/approve`,
  `PATCH /:id/reject`, `GET /` (list, filterable by type/status/date range).

---

## 7. Loans

**Files:** `models/Loan.js`, `controllers/loanController.js`,
`services/loanService.js`, `routes/loan.js`

- Rich schema modeled on a physical loan application form: loan terms
  (amount, interest %, duration in months, purpose, repayment method),
  disbursement details, embedded `guarantor` sub-doc, embedded `repayments[]`
  ledger, and a `creditAnalysis` sub-doc (the "for official use" / credit
  unit section, filled separately).
- Pre-validate hook auto-computes `amountToPay` (principal + interest) and
  `monthlyPayment` (amountToPay / duration) when not explicitly provided.
- **Workflow is two-stage**: Account Manager `recommend`s (advisory — sets
  `recommendation: recommended|not_recommended`, does NOT change `status`)
  → Admin/Super Admin `approve`/`reject` (changes `status`, and on approval
  creates the corresponding `loan`-type `Transaction`).
- Approval tiering identical to transactions (`loans.approve.tier1/tier2`
  vs the ₦200k threshold).
- `LOANS_REVERT` (Super Admin only): rolls an approved/rejected loan back to
  pending; if it had been disbursed, marks the disbursement transaction
  "reverted" so it drops out of balance calcs but stays in the audit trail.
- `_import` field is migration bookkeeping only (see §11) — ignore in normal
  app logic.
- Endpoints: `POST /`, `PATCH /:id/recommend`, `/:id/approve`, `/:id/reject`,
  `/:id/revert`, `/:id/credit-analysis`, `GET /`.

---

## 8. Staff / User Management

**Files:** `controllers/userController.js`, `services/userService.js`, `routes/user.js`

- Distinct from customer management — this is internal staff CRUD.
- Admin/Super Admin create staff (`USERS_MANAGE_STAFF` / `.ALL`). Admin can't
  create/promote another Admin or Super Admin — Super Admin only.
- `PUT /transfer-customer` reassigns a customer's `assignedTo` staff member.
- `DELETE /staff/:staffId` blocked if the staff still owns customers (must
  transfer first) or is the last remaining Super Admin.
- Endpoints: `POST/GET /staff`, `GET /staff/:staffId`, `DELETE /staff/:staffId`,
  `PUT /transfer-customer`.

---

## 9. Dashboards

**Files:** `controllers/dashboardController.js`, `services/dashboardService.js`,
`routes/dashboard.js`, `utils/dateFilter.js`

- Three role-specific views, all supporting `filter` query param
  (`daily|weekly|monthly|quarterly|custom` + `startDate`/`endDate` for custom):
  - `GET /admin` — org-wide cards (deposits/withdrawals/loans/customers
    totals), pending counts, per-cashier daily performance breakdown.
  - `GET /account-manager` — assigned customers, pending loans on them,
    repayment tracking.
  - `GET /cashier` — the logged-in cashier's own transaction totals + active
    customer count.
- Date-range logic centralized in `utils/dateFilter.js`.

---

## 10. Reports

**Files:** `controllers/generateReportController.js`, `services/generateReportService.js`,
`routes/report.js`, uses `pdfkit`

- Two output modes per report: JSON (preview) and PDF (download).
- `GET /customers/:customerId/report` — PDF, `GET /reports/customer/:id/data` — JSON.
  Contains customer details, transaction history, loans, balance summary,
  guarantor info.
- `GET /reports/cashier-report` — PDF, `GET /reports/cashier/:id/data` — JSON.
  Staff performance statement for a date range.
- Access: `REPORTS_GENERATE_ALL` (any) vs `REPORTS_GENERATE_OWN` (only
  customers/records the actor owns).

---

## 11. Notifications

**Files:** `models/Notification.js`, `controllers/notificationController.js`,
`services/notificationService.js`, `routes/notification.js`

- **In-app only** — no SMS/email yet (explicitly deferred, see README).
- Fired automatically by the relevant service (customer/transaction/loan/role
  services) whenever an approval-driven state change happens. Full trigger →
  recipient matrix is documented in the root `README.md` table — treat that
  as authoritative and keep `NOTIFICATION_TYPES` in `models/Notification.js`
  in sync with it when adding new triggers.
- Endpoints: `GET /` (supports `?unreadOnly=true`), `GET /unread-count`,
  `PATCH /:id/read`, `PATCH /read-all`.

---

## 12. Data import / migration scripts

**Files:** `scripts/*.js` (not mounted as HTTP routes — run manually via `node scripts/x.js`)

- `admin.js` — seeds the 4 system roles + bootstraps the initial Super Admin
  (uses `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars). Run via `npm run seed`.
- `importContributions.js`, `importLoans.js`, `Importrepayments.js` — one-off
  bulk importers from `faircolordata.xlsx` (legacy spreadsheet ledger) into
  Mongo. They write to `Loan._import` for idempotency/audit bookkeeping.
- `fixPhoneIndex.js` — one-off index repair script for the phone unique index.
- Treat these as operational tooling, not part of the request/response API.

---

## 13. Cross-cutting infrastructure

- **Security middleware stack** (`index.js`): `helmet()`, `cookie-parser`,
  custom `cors` config (`config/cors.js` — explicit origin allowlist,
  `credentials: true`), `express.json()`.
- **Error handling**: all errors funnel through `middlewares/errorHandler.js`.
  Throw `new AppError(message, statusCode)` (`utils/appError.js`) from
  services/controllers for expected/operational errors; Mongoose
  `CastError`/`ValidationError` and JWT errors are normalized automatically.
- **IDs**: every domain model has a human-readable `publicId`
  (`utils/publicId.js`, `generatePublicId(prefix)`) in addition to Mongo `_id`.
  Prefer `publicId` in path params / client-facing responses; Mongo `_id`
  is internal.
- **Audit trail**: `models/AuditLog.js` — generic `{action, performedBy,
  targetId, meta}` doc. Check services for where entries are (or should be)
  written when adding new mutating actions.
- **Currency/formatting helpers**: `utils/currency.js`, `utils/normalizePhone.js`.
- **Swagger**: JSDoc blocks live directly above each route handler in
  `routes/*.js`; compiled into a spec by `swagger/swagger.js` and served at
  `/docs`. Keep these in sync when changing a route's contract — they are
  the closest thing this repo has to a formal API spec.

---

## 14. Environment variables (names only — see `.env`, never commit values)

`MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`,
`JWT_REFRESH_EXPIRES_IN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`, `NODE_ENV`.
Commented-out/unused-currently: `PAYSTACK_SECRET`, `CLOUDINARY_*`, `BREVO_API_KEY`
(cloudinary/nodemailer deps are installed but not yet wired into a feature —
check before assuming they're active).

---

## 15. Conventions to follow when extending this app

1. Add new permissions to `PERMISSIONS` in `utils/permissions.js` first;
   never hardcode a permission string elsewhere.
2. New protected route → `protect` then `requirePermission(...)` (or
   `requireAllPermissions`) in that order.
3. Business rules (ownership checks, tier logic, cross-model cascades) belong
   in `services/`, not `controllers/` or `routes/`.
4. If a new action should notify someone, extend `NOTIFICATION_TYPES` in
   `models/Notification.js` and add the trigger in the relevant service —
   then update the trigger table in root `README.md`.
5. Give new domain models a `publicId` with a distinct prefix, following the
   `generatePublicId(prefix)` pattern already used everywhere.
6. Document new/changed endpoints with a Swagger JSDoc block in the route
   file — this repo has no separate OpenAPI spec file.