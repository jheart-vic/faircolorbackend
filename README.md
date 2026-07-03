# Fair Colours Microfinance Bank — Backend

A digital ledger and core banking API for the Fair Colours Microfinance Bank MVP:
customer management, deposits, withdrawals, loans, reporting, and dynamic
role-based access control.

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGO_URI, JWT secret, ADMIN_EMAIL, ADMIN_PASSWORD
npm run seed            # seeds the 4 system roles + bootstrap Super Admin
npm run migrate:roles   # only needed once, if migrating from an older deployment
npm start
```

Swagger docs are served at `/api-docs` once the server is running.

## Roles & Permissions

Roles are **data**, not hardcoded strings. Every role is a document in the
`roles` collection holding a name and a list of permission strings (see
`utils/permissions.js` for the full permission catalog). This means:

- **Super Admin** and **Admin** can create new custom roles and reassign
  users to any role, via `/api/roles`, without a code change.
- An Admin can never grant a permission they don't hold themselves, and can
  never create/promote another Admin or Super Admin — only a Super Admin can.
- The four MVP-defined roles are seeded as **system roles** and can't be
  deleted; only a Super Admin can edit their permissions.

| Role | Core responsibilities |
|---|---|
| **Super Admin** | Full system access, manages all staff and roles, approves transactions/loans of any amount, system configuration, audit logs. |
| **Admin** | Approves customer registrations and staff-created loans/transactions up to the tier-1 threshold, manages customers and staff, can create/assign roles (excluding Super Admin). |
| **Account Manager** | Manages assigned customers, monitors their accounts, reviews and recommends loan applications, generates customer reports. |
| **Cashier** | Registers customers, processes deposits/withdrawals, submits loan applications for their own customers. |

## Transaction & Loan Approval Workflow

Applies uniformly to deposits, withdrawals, and loan disbursements:

- **≤ ₦200,000** → requires the `tier1` approval permission (Admin or Super Admin).
- **> ₦200,000** → requires the `tier2` approval permission (Super Admin only).

The threshold lives in one place: `APPROVAL_THRESHOLD` in `utils/permissions.js`.

## Key API groups

- `POST /api/auth/login`, `/refresh`, `/logout`
- `POST/GET /api/roles`, `PATCH /api/roles/:roleId`, `PATCH /api/roles/users/:userId/assign`
- `POST/GET /api/users/staff`, `DELETE /api/users/staff/:staffId`, `PUT /api/users/transfer-customer`
- `POST/GET /api/customers`, approve/deactivate/delete/balance endpoints
- `POST /api/transactions/deposit`, `/withdraw`, `PATCH /:id/approve`, `/:id/reject`
- `POST /api/loans`, `PATCH /:id/recommend`, `/:id/approve`, `/:id/reject`, `/:id/credit-analysis`
- `GET /api/dashboard/admin`, `/account-manager`, `/cashier`
- `GET /api/reports/...` (customer & staff performance PDF/JSON reports)
- `GET /api/notifications`, `/unread-count`, `PATCH /:id/read`, `/read-all`

## In-App Notifications

Every approval-driven workflow now creates a notification record so staff
know what needs their attention without polling the list endpoints:

| Trigger | Who's notified |
|---|---|
| Customer registered | Everyone with `customers.approve` |
| Customer approved | The staff member who created/is assigned to the customer |
| Deposit/withdrawal submitted | Everyone holding the correct approval-tier permission |
| Transaction approved/rejected | The Cashier who submitted it |
| Loan submitted | Account Managers (`loans.review`) and the correct approval tier |
| Loan recommended/declined | Whoever needs to approve it |
| Loan approved/rejected | The loan's creator and its Account Manager reviewer |
| Role changed | The staff member whose role changed |

These are in-app only (see `models/Notification.js`, `services/notificationService.js`).
SMS/Email delivery is a Next Phase item — see below.

- `GET /api/notifications` — list (supports `?unreadOnly=true`)
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

## Next-phase (not implemented in this MVP)

Progressive Web App, native mobile apps, mobile/internet banking, SMS/email
notifications, multi-branch support, biometric login, accounting
integration, and analytics dashboards are intentionally out of scope for
this backend release — see the MVP document's roadmap.
