import express from "express";
import * as controller from "../controllers/dashboardController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";

const router = express.Router();

/**
 * @swagger
 * /api/dashboard/admin:
 *   get:
 *     summary: Get admin dashboard data
 *     description: Returns financial summaries and pending counts for the selected time range
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly]
 *           example: monthly
 *         description: Time filter for transactions and customers
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
 *                   properties:
 *                     customers:
 *                       type: number
 *                       example: 10
 *                     transactions:
 *                       type: number
 *                       example: 5
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get(
  "/admin",
  protect,
  authorize("admin"),
  controller.getAdminDashboard
);

/**
 * @swagger
 * /api/dashboard/cashier:
 *   get:
 *     summary: Get cashier dashboard data
 *     description: Returns transaction summaries and customer count for the logged-in cashier
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         required: false
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, quarterly]
 *           example: weekly
 *         description: Time filter for transactions
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
 *                   properties:
 *                     deposits:
 *                       type: number
 *                       example: 80000
 *                     withdrawals:
 *                       type: number
 *                       example: 20000
 *                     loans:
 *                       type: number
 *                       example: 50000
 *                     customers:
 *                       type: number
 *                       example: 25
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Cashier only)
 */
router.get(
  "/cashier",
  protect,
  authorize("cashier"),
  controller.getCashierDashboard
);

export default router;