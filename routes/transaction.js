import express from "express";
import * as controller from "../controllers/transactionController.js";
import { protect } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/permission.js";
import { PERMISSIONS } from "../utils/permissions.js";
const router = express.Router();

/**
 * @swagger
 * /api/transactions/deposit:
 *   post:
 *     summary: Create deposit (any role with transactions.create — Cashier by default)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, amount]
 *             properties:
 *               customerId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 example: 5000
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Deposit created (pending approval)
 */
router.post(
  "/deposit",
  protect,
  requirePermission(PERMISSIONS.TRANSACTIONS_CREATE),
  controller.createDepositController
);

/**
 * @swagger
 * /api/transactions/withdraw:
 *   post:
 *     summary: Create withdrawal (any role with transactions.create — Cashier by default)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, amount]
 *             properties:
 *               customerId:
 *                 type: string
 *               amount:
 *                 type: number
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Withdrawal created (pending)
 */
router.post(
  "/withdraw",
  protect,
  requirePermission(PERMISSIONS.TRANSACTIONS_CREATE),
  controller.createWithdrawalController
);


/**
 * @swagger
 * /api/transactions/{transactionId}/approve:
 *   patch:
 *     summary: Approve a pending transaction (Admin ≤₦200,000; Super Admin for any amount)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction approved
 *       400:
 *         description: Already processed
 *       404:
 *         description: Not found
 */
router.patch(
  "/:transactionId/approve",
  protect,
  requirePermission(
    PERMISSIONS.TRANSACTIONS_APPROVE_TIER1,
    PERMISSIONS.TRANSACTIONS_APPROVE_TIER2
  ),
  controller.approveTransactionController
);

/**
 * @swagger
 * /api/transactions/{transactionId}/reject:
 *   patch:
 *     summary: Reject a pending transaction (Admin & Super Admin)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction rejected
 */
router.patch(
  "/:transactionId/reject",
  protect,
  requirePermission(
    PERMISSIONS.TRANSACTIONS_APPROVE_TIER1,
    PERMISSIONS.TRANSACTIONS_APPROVE_TIER2
  ),
  controller.rejectTransactionController
);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transactions (full list for Admin/Super Admin, own transactions otherwise)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [deposit, withdraw, loan]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Transactions fetched successfully
 */
router.get(
  "/",
  protect,
  requirePermission(
    PERMISSIONS.TRANSACTIONS_VIEW_ALL,
    PERMISSIONS.TRANSACTIONS_VIEW_OWN
  ),
  controller.getTransactionsController
);



export default router;