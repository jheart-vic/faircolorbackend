import express from "express";
import * as controller from "../controllers/loanController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";

const router = express.Router();

/**
 * @swagger
 * /api/loans:
 *   post:
 *     summary: Create loan (Cashier only)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, amount, duration]
 *             properties:
 *               customerId:
 *                 type: string
 *               amount:
 *                 type: number
 *               duration:
 *                 type: number
 *                 description: Loan duration in months (1, 2, 3, 4, or 6)
 *                 enum: [1, 2, 3, 4, 6]
 *                 example: 6
 *     responses:
 *       201:
 *         description: Loan created (pending)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 amount:
 *                   type: number
 *                   example: 117000
 *                 interest:
 *                   type: number
 *                   description: Auto-applied rate based on duration (1m=12%, 2m=20%, 3m=25%, 4m=30%, 6m=35%)
 *                   example: 30
 *                 amountToPay:
 *                   type: number
 *                   description: Total repayment amount (amount + interest)
 *                   example: 152100
 *                 monthlyPayment:
 *                   type: number
 *                   description: Equal monthly installment (amountToPay / duration), rounded
 *                   example: 38025
 *                 duration:
 *                   type: number
 *                   example: 4
 *                 status:
 *                   type: string
 *                   example: pending
 *       400:
 *         description: Missing fields, invalid duration, or customer not approved
 */
router.post(
  "/",
  protect,
  authorize("cashier"),
  controller.createLoanController
);

/**
 * @swagger
 * /api/loans/{loanId}/approve:
 *   patch:
 *     summary: Approve loan (Admin only)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loan approved and transaction created
 *       400:
 *         description: Already processed
 *       404:
 *         description: Loan not found
 */
router.patch(
  "/:loanId/approve",
  protect,
  authorize("admin"),
  controller.approveLoan
);

/**
 * @swagger
 * /api/loans/{loanId}/reject:
 *   patch:
 *     summary: Reject loan (Admin only)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loan rejected
 *       400:
 *         description: Already processed
 *       404:
 *         description: Loan not found
 */
router.patch(
  "/:loanId/reject",
  protect,
  authorize("admin"),
  controller.rejectLoan
);

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: Get all loans (Admin only)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 */
router.get(
  "/",
  protect,
  authorize("admin"),
  controller.getLoans
);

export default router;