import express from "express";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";
import { downloadCashierReport, downloadCustomerReport } from "../controllers/generateReportController.js";

const router = express.Router();

/**
 * @swagger
 * /api/customers/{customerId}/report:
 *   get:
 *     summary: Download customer financial report (PDF)
 *     description: |
 *       Generates a PDF report containing:
 *       - Customer details
 *       - Transaction history
 *       - Loan records
 *       - Balance summary
 *
 *       Access Control:
 *       - Admin → all customers
 *       - Cashier → only assigned customers
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer publicId
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/:customerId/report",
  protect,
  authorize("admin", "cashier"),
  downloadCustomerReport
);

/**
 * @swagger
 * /api/reports/cashier-report:
 *   get:
 *     summary: Download cashier financial report (PDF)http://localhost:PORT/api/reports/cashier-report?cashierId=CASH-XXXXXX&filter=monthly
 *     description: |
 *       Admin-only endpoint to generate a cashier statement.
 *
 *       Filters:
 *       - daily
 *       - weekly
 *       - monthly
 *       - custom (requires startDate & endDate)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cashierId
 *         required: true
 *         schema:
 *           type: string
 *           example: CASH_123456
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, custom]
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
 *     responses:
 *       200:
 *         description: PDF report
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/cashier-report",
  protect,
  authorize("admin"),
  downloadCashierReport
);

export default router;