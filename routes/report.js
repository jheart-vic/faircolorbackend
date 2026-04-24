import express from "express";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";
import { downloadCashierReport, downloadCustomerReport, getCashierReport, getCustomerReport } from "../controllers/generateReportController.js";

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

/**
 * @swagger
 * /api/reports/cashier/{cashierId}/data:
 *   get:
 *     summary: Get cashier financial report (JSON)
 *     description: |
 *       Admin-only endpoint to retrieve cashier transaction data in JSON format.
 *       Use this to preview report data before downloading the PDF.
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
 *       - in: path
 *         name: cashierId
 *         required: true
 *         schema:
 *           type: string
 *           example: CASH-123456
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
 *         description: Cashier report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     cashier:
 *                       type: object
 *                       properties:
 *                         publicId:
 *                           type: string
 *                           example: CASH-123456
 *                         fullName:
 *                           type: string
 *                           example: John Doe
 *                     period:
 *                       type: string
 *                       example: Monthly Report - April 2026
 *                     summary:
 *                       type: object
 *                       properties:
 *                         deposits:
 *                           type: number
 *                           example: 500000
 *                         withdrawals:
 *                           type: number
 *                           example: 200000
 *                         loans:
 *                           type: number
 *                           example: 100000
 *                         balance:
 *                           type: number
 *                           example: 200000
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           customer:
 *                             type: string
 *                           customerId:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [deposit, withdrawal, loan]
 *                           amount:
 *                             type: number
 *                           note:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [approved, rejected, pending]
 *       403:
 *         description: Unauthorized - Admin only
 *       404:
 *         description: Cashier not found
 */
router.get("/cashier/:cashierId/data", protect, authorize("admin"), getCashierReport);

/**
 * @swagger
 * /api/reports/customer/{customerId}/data:
 *   get:
 *     summary: Get customer financial report (JSON)
 *     description: |
 *       Admin and cashier endpoint to retrieve customer transaction data in JSON format.
 *       Cashiers can only access customers they created or are assigned to.
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
 *       - in: path
 *         name: customerId
 *         required: true
 *         schema:
 *           type: string
 *           example: CUST-123456
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
 *         description: Customer report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       type: object
 *                       properties:
 *                         publicId:
 *                           type: string
 *                           example: CUST-123456
 *                         fullName:
 *                           type: string
 *                           example: Jane Doe
 *                         phone:
 *                           type: string
 *                           example: "08012345678"
 *                         address:
 *                           type: string
 *                           example: 12 Lagos Street, Abuja
 *                         status:
 *                           type: string
 *                           enum: [active, inactive, suspended]
 *                     guarantor:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         fullName:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         relationship:
 *                           type: string
 *                         address:
 *                           type: string
 *                     period:
 *                       type: string
 *                       example: Monthly Report - April 2026
 *                     summary:
 *                       type: object
 *                       properties:
 *                         deposits:
 *                           type: number
 *                           example: 300000
 *                         withdrawals:
 *                           type: number
 *                           example: 100000
 *                         loans:
 *                           type: number
 *                           example: 50000
 *                         balance:
 *                           type: number
 *                           example: 150000
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           type:
 *                             type: string
 *                             enum: [deposit, withdrawal, loan]
 *                           amount:
 *                             type: number
 *                           note:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [approved, rejected, pending]
 *                     loans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           publicId:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           interest:
 *                             type: number
 *                             example: 5
 *                           duration:
 *                             type: number
 *                             example: 12
 *                           status:
 *                             type: string
 *                             enum: [approved, rejected, pending]
 *                           date:
 *                             type: string
 *                             format: date-time
 *       403:
 *         description: Unauthorized - Not assigned to this customer
 *       404:
 *         description: Customer not found
 */
router.get("/customer/:customerId/data", protect, authorize("admin", "cashier"), getCustomerReport);
export default router;