import express from "express";
import { createCashier, getCashiers, transferCustomerController } from "../controllers/userController.js";
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
 *     summary: Get all cashiers(admin only)
 *     description: Fetch cashiers with pagination and optional filters
 *     tags:
 *       - Users
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
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                         example: cashier
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
 *       500:
 *         description: Server error
 */
router.get("/cashiers", protect, authorize("admin"), getCashiers);

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