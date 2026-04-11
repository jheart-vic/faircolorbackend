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
 *                 example: CUS-ABC123
 *               amount:
 *                 type: number
 *                 example: 117000
 *               duration:
 *                 type: number
 *                 enum: [1, 2, 3, 4, 6]
 *                 example: 6
 *               purpose:
 *                 type: string
 *                 example: Business capital for stock purchase
 *               repaymentMethod:
 *                 type: string
 *                 enum: [daily, weekly, monthly, quarterly]
 *                 example: monthly
 *               guarantor:
 *                 type: object
 *                 properties:
 *                   fullName:
 *                     type: string
 *                     example: John Doe
 *                   maritalStatus:
 *                     type: string
 *                     enum: [single, married, divorced, widowed]
 *                     example: married
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                     example: 1985-03-15
 *                   state:
 *                     type: string
 *                     example: Lagos
 *                   address:
 *                     type: string
 *                     example: 5 Abuja Crescent, Ikeja
 *                   landmark:
 *                     type: string
 *                     example: Near Total Filling Station
 *                   lga:
 *                     type: string
 *                     example: Ikeja
 *                   phone:
 *                     type: string
 *                     example: "08098765432"
 *                   email:
 *                     type: string
 *                     example: john.doe@gmail.com
 *                   relationship:
 *                     type: string
 *                     example: Brother
 *                   country:
 *                     type: string
 *                     example: Nigeria
 *     responses:
 *       201:
 *         description: Loan created (pending)
 *       400:
 *         description: Missing fields, invalid duration, or customer not approved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Cashier only
 *       404:
 *         description: Customer not found or not assigned to you
 */
router.post("/", protect, authorize("cashier"), controller.createLoanController);

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

/**
 * @swagger
 * /api/loans/{loanId}/credit-analysis:
 *   patch:
 *     summary: Fill credit analysis for a loan (Admin only)
 *     description: |
 *       Fills the "For Official Use Only" section of the loan form.
 *       This is done by the credit unit after the loan has been submitted by the cashier.
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: loanId
 *         required: true
 *         schema:
 *           type: string
 *           example: LOAN-XYZ789
 *         description: Public ID of the loan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guarantyFund:
 *                 type: number
 *                 example: 50000
 *               upfrontCharges:
 *                 type: number
 *                 example: 5000
 *               expectedInterest:
 *                 type: number
 *                 example: 40950
 *               totalIncomeExpected:
 *                 type: number
 *                 example: 157950
 *               repaymentPlan:
 *                 type: string
 *                 example: Monthly deduction from savings
 *               accountOfficer:
 *                 type: string
 *                 example: Emeka Nwosu
 *               headBusinessDevelopment:
 *                 type: string
 *                 example: Amaka Obi
 *               hopFincon:
 *                 type: string
 *                 example: Chidi Eze
 *               internalControl:
 *                 type: string
 *                 example: Ngozi Adaeze
 *               accountNo:
 *                 type: string
 *                 example: "0123456789"
 *     responses:
 *       200:
 *         description: Credit analysis updated successfully
 *       400:
 *         description: Cannot update credit analysis on a rejected loan
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Loan not found
 */
router.patch('/:loanId/credit-analysis', protect, authorize('admin'), controller.updateCreditAnalysisController)

export default router;