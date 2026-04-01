import express from "express";
import { approveCustomer, createCustomer, getCustomers } from "../controllers/customerController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";

const router = express.Router();


/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers (Admin & Cashier)
 *     description: Fetch customers with pagination and optional filters
 *     tags:
 *       - Customers
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
 *         name: search
 *         schema:
 *           type: string
 *           example: John
 *         description: Search by first name or last name
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *           example: 0803
 *         description: Filter by phone number
 *     responses:
 *       200:
 *         description: Customers fetched successfully
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
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     pages:
 *                       type: integer
 *                       example: 10
 *       500:
 *         description: Server error
 */
router.get("/", protect, authorize("admin", "cashier"), getCustomers);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a customer (Admin & Cashier)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, phone]
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: Victor
 *               lastName:
 *                 type: string
 *                 example: Adebowale
 *               phone:
 *                 type: string
 *                 example: 08031234567
 *               address:
 *                 type: string
 *                 example: Lagos, Nigeria
 *     responses:
 *       201:
 *         description: Customer created successfully (status = pending)
 *       400:
 *         description: Customer with this phone already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post(
  "/",
  protect,
  authorize("admin", "cashier"),
  createCustomer
);

/**
 * @swagger
 * /api/customers/{customerId}/approve:
 *   patch:
 *     summary: Approve customer (Admin only)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer approved successfully
 *       400:
 *         description: Already approved
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  "/:customerId/approve",
  protect,
  authorize("admin"),
  approveCustomer
);

export default router;