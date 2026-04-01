import express from "express";
import * as controller from "../controllers/transactionController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";
const router = express.Router();

/**
 * @swagger
 * /api/transactions/deposit:
 *   post:
 *     summary: Create deposit (Cashier only)
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
 *     responses:
 *       201:
 *         description: Deposit created (pending approval)
 */
router.post(
  "/deposit",
  protect,
  authorize("cashier"),
  controller.createDepositController
);

/**
 * @swagger
 * /api/transactions/withdraw:
 *   post:
 *     summary: Create withdrawal (Cashier only)
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
 *     responses:
 *       201:
 *         description: Withdrawal created (pending)
 */
router.post(
  "/withdraw",
  protect,
  authorize("cashier"),
  controller.createWithdrawalController
);


/**
 * @swagger
 * /api/transactions/{transactionId}/approve:
 *   patch:
 *     summary: Approve transaction (Admin only)
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
  authorize("admin"),
  controller.approveTransactionController
);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Get transactions (Admin & Cashier)
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
  authorize("admin", "cashier"),
  controller.getTransactionsController
);



export default router;