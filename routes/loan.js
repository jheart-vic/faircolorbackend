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
 *             required: [customerId, amount, interest, duration]
 *             properties:
 *               customerId:
 *                 type: string
 *               amount:
 *                 type: number
 *               interest:
 *                 type: number
 *                 example: 5
 *               duration:
 *                 type: number
 *                 example: 6
 *     responses:
 *       201:
 *         description: Loan created (pending)
 *       400:
 *         description: Missing fields or customer not approved
 */
router.post(
  "/loan",
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