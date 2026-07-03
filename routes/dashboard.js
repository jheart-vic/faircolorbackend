import express from "express";
import * as controller from "../controllers/dashboardController.js";
import { protect } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/permission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = express.Router();

/**
 * @swagger
 * /api/dashboard/admin:
 *   get:
 *     summary: Get admin dashboard data (Admin & Super Admin)
 *     description: Returns financial summaries, pending counts, and daily cashier performance for the selected time range.
 *     tags:
 *       - Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, custom]
 *           example: monthly
 *         description: Time filter for transactions and customers
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom range (required if filter is "custom")
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom range (required if filter is "custom")
 *       - in: query
 *         name: includeDeactivated
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include deactivated customers in totals
 *     responses:
 *       200:
 *         description: Dashboard data fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cards:
 *                   type: object
 *                   description: Total amounts and counts for key metrics
 *                   properties:
 *                     deposits:
 *                       type: number
 *                       example: 150000
 *                     withdrawals:
 *                       type: number
 *                       example: 50000
 *                     loans:
 *                       type: number
 *                       example: 200000
 *                     customers:
 *                       type: number
 *                       example: 120
 *                 pending:
 *                   type: object
 *                   description: Counts of pending items
 *                   properties:
 *                     customers:
 *                       type: number
 *                       example: 10
 *                     transactions:
 *                       type: number
 *                       example: 5
 *                 cashiers:
 *                   type: array
 *                   description: Daily totals for each cashier
 *                   items:
 *                     type: object
 *                     properties:
 *                       cashierId:
 *                         type: string
 *                         example: "CASHIER123"
 *                       name:
 *                         type: string
 *                         example: "Jane Doe"
 *                       dailyTotals:
 *                         type: array
 *                         description: Transactions grouped by day
 *                         items:
 *                           type: object
 *                           properties:
 *                             date:
 *                               type: string
 *                               format: date
 *                               example: "2026-04-02"
 *                             deposits:
 *                               type: number
 *                               example: 10000
 *                             withdrawals:
 *                               type: number
 *                               example: 5000
 *                             loans:
 *                               type: number
 *                               example: 20000
 *                             count:
 *                               type: number
 *                               example: 15
 *       401:
 *         description: Unauthorized (invalid or missing token)
 *       403:
 *         description: Forbidden - requires Admin/Super Admin level report access
 */
router.get(
  "/admin",
  protect,
  requirePermission(PERMISSIONS.REPORTS_GENERATE_ALL, PERMISSIONS.TRANSACTIONS_VIEW_ALL),
  controller.getAdminDashboard
);

/**
 * @swagger
 * /api/dashboard/account-manager:
 *   get:
 *     summary: Get Account Manager dashboard data (Account Manager, Admin & Super Admin)
 *     description: >
 *       Returns the Account Manager's assigned customers, pending loans on
 *       those customers, and repayment tracking. Supports time-based
 *       filtering.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, custom]
 *     responses:
 *       200:
 *         description: Account Manager dashboard data fetched successfully
 */
router.get(
  "/account-manager",
  protect,
  requirePermission(PERMISSIONS.LOANS_REVIEW),
  controller.getAccountManagerDashboard
);

/**
 * @swagger
 * /api/dashboard/cashier:
 *   get:
 *     summary: Get cashier dashboard data (any role that creates transactions — Cashier by default)
 *     description: >
 *       Returns transaction summaries (deposits, withdrawals, loans) and the total number of active customers
 *       created by the logged-in cashier. Supports time-based filtering.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly, custom]
 *           example: weekly
 *         description: Time filter for transactions and customers. Custom allows using startDate and endDate.
 *       - in: query
 *         name: startDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom filter (YYYY-MM-DD). Required if filter=custom.
 *       - in: query
 *         name: endDate
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom filter (YYYY-MM-DD). Required if filter=custom.
 *     responses:
 *       200:
 *         description: Cashier dashboard data fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cards:
 *                   type: object
 *                   description: Summary totals for the logged-in cashier
 *                   properties:
 *                     deposits:
 *                       type: number
 *                       example: 80000
 *                       description: Total approved deposit amount in the selected period
 *                     withdrawals:
 *                       type: number
 *                       example: 20000
 *                       description: Total approved withdrawal amount in the selected period
 *                     loans:
 *                       type: number
 *                       example: 50000
 *                       description: Total approved loan amount in the selected period
 *                     customers:
 *                       type: number
 *                       example: 25
 *                       description: Total number of active customers created by the cashier in the selected period
 *       401:
 *         description: Unauthorized – user must be logged in
 *       403:
 *         description: Forbidden - requires transactions.create or transactions.view.own permission
 */
router.get(
  "/cashier",
  protect,
  requirePermission(PERMISSIONS.TRANSACTIONS_CREATE, PERMISSIONS.TRANSACTIONS_VIEW_OWN),
  controller.getCashierDashboard
);

export default router;