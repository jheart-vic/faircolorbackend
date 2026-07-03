# CLAUDE.md

Guidance for Claude (or any AI coding agent) working in this repository.

## Start here

Before making changes, read **`config/session.md`** — it's a feature-by-feature
map of the whole app (auth, RBAC, customers, transactions, loans, dashboards,
reports, notifications, scripts) written for exactly this purpose. Keep it
up to date: if you add, remove, or materially change a feature, update the
matching section there in the same change.

## What this is

Node.js/Express 5 REST API for **Fair Colours Microfinance Bank** — a digital
ledger MVP (customers, deposits/withdrawals, loans, dynamic role-based
access control, PDF/JSON reports, in-app notifications). MongoDB via
Mongoose. ESM modules (`"type": "module"` in `package.json`).

## Commands

```bash
npm install
npm run dev      # nodemon index.js — local dev
npm start        # node index.js — production
npm run seed     # scripts/admin.js — seeds the 4 system roles + bootstrap Super Admin
```

No test suite currently exists (`npm test` is a placeholder). Don't assume
tests exist or invent test-running instructions.

Swagger/API docs are served at `/docs` once the server is running.

## Architecture (read this before adding a feature)

Strict layering, follow it for anything new:

```
routes/*.js       — Express router + inline Swagger JSDoc + auth/perm wiring
controllers/*.js  — thin HTTP glue only (parse req → call service → shape res)
services/*.js     — all business logic and Mongoose queries live here
models/*.js       — Mongoose schemas/hooks/virtuals
middlewares/      — protect (JWT auth), requirePermission (RBAC), errorHandler
utils/            — permissions catalog, tokens, public IDs, currency, etc.
```

Naming: `routes/x.js` → `controllers/xController.js` → `services/xService.js`
→ `models/X.js`. Match this pattern for new features rather than improvising
a new structure.

## The most important design decision in this codebase

**Roles are data, not code.** `models/Role.js` documents hold a name + a list
of permission strings; `utils/permissions.js` is the single source of truth
for every valid permission string and for the 4 seeded system roles
(`super_admin`, `admin`, `account_manager`, `cashier`). Custom roles can be
created at runtime via the API with no code change. Never hardcode a role
name as an authorization check — always gate on a permission string via
`requirePermission()` / `requireAllPermissions()` from `middlewares/permission.js`.
`requireRoleSlug()` exists only for the rare literal-role case (protecting
the Super Admin bootstrap role) — avoid it otherwise.

Approval-tier logic (₦200,000 threshold, tier1 = Admin, tier2 = Super Admin)
is centralized in `utils/permissions.js` (`APPROVAL_THRESHOLD`,
`approvalPermissionFor`). Change the threshold in exactly one place.

## Conventions

- New protected route: `protect` middleware, then `requirePermission(...)`,
  in that order — see any file in `routes/` for the pattern.
- Put ownership checks, cross-model cascades, and other business rules in
  `services/`, never in `controllers/` or `routes/`.
- Throw `new AppError(message, statusCode)` (`utils/appError.js`) for
  expected/operational errors; `middlewares/errorHandler.js` normalizes
  Mongoose and JWT errors automatically — don't hand-roll that logic again.
- Every domain model gets a human-readable `publicId` via
  `generatePublicId(prefix)` (`utils/publicId.js`). Use `publicId` in path
  params and client-facing responses; keep Mongo `_id` internal.
- Document every new/changed endpoint with a Swagger JSDoc block directly
  above the route handler — there is no separate OpenAPI spec file, the
  JSDoc comments in `routes/*.js` are the spec.
- If an action should notify someone, add/extend the type in
  `models/Notification.js`'s `NOTIFICATION_TYPES`, add the trigger in the
  relevant service, and update the trigger table in `README.md`.

## Things to double-check before assuming they're wired up

`cloudinary`, `nodemailer`, `streamifier`, and `multer` are installed
dependencies but may not be actively used by any current feature — verify
with a search before building on top of them. Commented-out env vars
(`PAYSTACK_SECRET`, `CLOUDINARY_*`, `BREVO_API_KEY`) are not currently loaded.

## Secrets

Never read, print, or commit `.env` values. Env var *names* only are listed
in `config/session.md` §14.

## Do not touch without explicit instruction

`scripts/importContributions.js`, `scripts/importLoans.js`,
`scripts/Importrepayments.js`, `scripts/fixPhoneIndex.js` — one-off/legacy
migration tooling tied to `faircolordata.xlsx`. Not part of the live API;
changing them risks corrupting the idempotency bookkeeping in `Loan._import`.