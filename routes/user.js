import express from "express";
import { createCashier, getCashierById, getCashiers, transferCustomerController } from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";

const router = express.Router();

/**
 * @swagger
 * /api/users/cashiers:
 *   post:
 *     summary: Create a cashier (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@mail.com
 *               password:
 *                 type: string
 *                 example: password123
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cashier created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 fullName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *       400:
 *         description: Email already in use
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.post(
  "/cashiers",
  protect,
  authorize("admin"),
  createCashier
);

/**
 * @swagger
 * /api/users/cashiers:
 *   get:
 *     summary: Get all cashiers (Admin only)
 *     description: Fetch cashiers with pagination, filters, and activity stats
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 10
 *         description: Number of records per page
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *           example: Victor
 *         description: Filter by cashier name
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           example: test@mail.com
 *         description: Filter by cashier email
 *     responses:
 *       200:
 *         description: Cashiers fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       cashier:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           publicId:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                       stats:
 *                         type: object
 *                         properties:
 *                           totalCustomers:
 *                             type: integer
 *                             example: 20
 *                           totalTransactions:
 *                             type: integer
 *                             example: 50
 *                           totalLoans:
 *                             type: integer
 *                             example: 10
 *                           deposits:
 *                             type: number
 *                             example: 500000
 *                           withdrawals:
 *                             type: number
 *                             example: 200000
 *                           loans:
 *                             type: number
 *                             example: 100000
 *                           netBalance:
 *                             type: number
 *                             example: 200000
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       500:
 *         description: Server error
 */
router.get("/cashiers", protect, authorize("admin"), getCashiers);

/**
 * @swagger
 * /api/users/cashiers/{cashierId}:
 *   get:
 *     summary: Get a single cashier with full activity (Admin only)
 *     description: |
 *       Returns cashier profile, stats, and paginated activity
 *       (customers, transactions, loans). Filter by date range or transaction type.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cashierId
 *         required: true
 *         schema:
 *           type: string
 *           example: USR-ABC123
 *         description: Public ID of the cashier
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: 2024-01-01
 *         description: Filter activities from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: 2024-12-31
 *         description: Filter activities up to this date
 *       - in: query
 *         name: transactionType
 *         schema:
 *           type: string
 *           enum: [deposit, withdrawal, loan]
 *         description: Filter transactions by type
 *     responses:
 *       200:
 *         description: Cashier fetched successfully
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
 *                         id:
 *                           type: string
 *                         publicId:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalCustomers:
 *                           type: integer
 *                         totalTransactions:
 *                           type: integer
 *                         totalLoans:
 *                           type: integer
 *                         deposits:
 *                           type: number
 *                         withdrawals:
 *                           type: number
 *                         loans:
 *                           type: number
 *                         netBalance:
 *                           type: number
 *                     customers:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                         pagination:
 *                           type: object
 *                     transactions:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                         pagination:
 *                           type: object
 *                     loans:
 *                       type: object
 *                       properties:
 *                         data:
 *                           type: array
 *                           items:
 *                             type: object
 *                         pagination:
 *                           type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Cashier not found
 *       500:
 *         description: Server error
 */
router.get("/cashiers/:cashierId", protect, authorize("admin"), getCashierById);

/**
 * @swagger
 * /api/users/transfer-customer:
 *   put:
 *     summary: Transfer a customer to another cashier
 *     description: Admin can reassign a customer from one cashier to another
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *               - newCashierId
 *             properties:
 *               customerId:
 *                 type: string
 *                 example: "CUS_123456"
 *               newCashierId:
 *                 type: string
 *                 example: "CASH_654321"
 *     responses:
 *       200:
 *         description: Customer transferred successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Customer transferred successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     createdBy:
 *                       type: string
 *       400:
 *         description: Bad request (invalid input or same cashier)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: Customer or cashier not found
 */
router.put(
  "/transfer-customer",
  protect,
  authorize("admin"),
  transferCustomerController
);

export default router;