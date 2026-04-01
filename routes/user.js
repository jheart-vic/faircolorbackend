import express from "express";
import { createCashier, getCashiers } from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";

const router = express.Router();

/**
 * @swagger
 * /api/users/cashier:
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
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: john@mail.com
 *               password:
 *                 type: string
 *                 example: password123
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
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                   example: cashier
 *       400:
 *         description: Email already in use
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 */
router.post(
  "/cashier",
  protect,
  authorize("admin"),
  createCashier
);

/**
 * @swagger
 * /api/cashiers:
 *   get:
 *     summary: Get all cashiers
 *     description: Fetch cashiers with pagination and optional filters
 *     tags:
 *       - Cashiers
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
router.get("/", protect, authorize("admin", "cashier"), getCashiers);

export default router;