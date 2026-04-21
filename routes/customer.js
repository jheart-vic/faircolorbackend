import express from "express";
import { approveCustomer, createCustomer, deleteCustomer, getCustomerBalance, getCustomers, toggleDeactivate } from "../controllers/customerController.js";
import { protect } from "../middlewares/auth.js";
import { authorize } from "../middlewares/role.js";

const router = express.Router();


/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get customers (Admin & Cashier)
 *     description: |
 *       Fetch customers with pagination and optional filters.
 *
 *       **Access Control:**
 *       - Admin → Can view all customers
 *       - Cashier → Can only view customers they created or assigned to them
 *
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           example: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           example: 10
 *         description: Number of records per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: John
 *         description: Search by full name, surname, or other name
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *           example: 0803
 *         description: Filter by phone number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved]
 *         description: Filter by customer status
 *       - in: query
 *         name: includeDeactivated
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include deactivated customers in the results
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
 *                       publicId:
 *                         type: string
 *                       title:
 *                         type: string
 *                         enum: [Mr, Mrs, Miss, Dr, Prof]
 *                       surname:
 *                         type: string
 *                       otherName:
 *                         type: string
 *                       fullName:
 *                         type: string
 *                         description: Auto-derived from surname + otherName
 *                       gender:
 *                         type: string
 *                         enum: [male, female]
 *                       maritalStatus:
 *                         type: string
 *                         enum: [single, married, divorced, widowed]
 *                       phone:
 *                         type: string
 *                       email:
 *                         type: string
 *                       address:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pending, approved]
 *                       createdBy:
 *                         type: object
 *                         properties:
 *                           fullName:
 *                             type: string
 *                           publicId:
 *                             type: string
 *                       assignedTo:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           fullName:
 *                             type: string
 *                           publicId:
 *                             type: string
 *                       approvedBy:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           fullName:
 *                             type: string
 *                           publicId:
 *                             type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Invalid role)
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
 *             required: [surname, phone, address]
 *             properties:
 *               title:
 *                 type: string
 *                 enum: [Mr, Mrs, Miss, Dr, Prof]
 *                 example: Mr
 *               surname:
 *                 type: string
 *                 example: Adeyemi
 *               otherName:
 *                 type: string
 *                 example: Bola
 *               gender:
 *                 type: string
 *                 enum: [male, female]
 *                 example: male
 *               maritalStatus:
 *                 type: string
 *                 enum: [single, married, divorced, widowed]
 *                 example: single
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 example: 1995-06-15
 *               nationality:
 *                 type: string
 *                 example: Nigerian
 *               bvn:
 *                 type: string
 *                 example: "12345678901"
 *               nin:
 *                 type: string
 *                 example: "98765432100"
 *               meansOfIdentification:
 *                 type: string
 *                 example: Voter's Card
 *               phone:
 *                 type: string
 *                 example: "08031234567"
 *               email:
 *                 type: string
 *                 example: adeyemi.bola@gmail.com
 *               address:
 *                 type: string
 *                 example: 12 Lagos Street, Yaba
 *               businessAddress:
 *                 type: string
 *                 example: 5 Broad Street, Lagos Island
 *               occupation:
 *                 type: string
 *                 example: Trader
 *               employerName:
 *                 type: string
 *                 example: Self-employed
 *               employerAddress:
 *                 type: string
 *                 example: Balogun Market, Lagos
 *               bankName:
 *                 type: string
 *                 example: Access Bank
 *               accountName:
 *                 type: string
 *                 example: Adeyemi Bola
 *               accountNumber:
 *                 type: string
 *                 example: "0123456789"
 *               nextOfKin:
 *                 type: object
 *                 properties:
 *                   fullName:
 *                     type: string
 *                     example: Jane Adeyemi
 *                   phone:
 *                     type: string
 *                     example: "08011111111"
 *                   address:
 *                     type: string
 *                     example: 12 Lagos Street, Yaba
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   fullName:
 *                     type: string
 *                     example: James Adeyemi
 *                   phone:
 *                     type: string
 *                     example: "08022222222"
 *                   address:
 *                     type: string
 *                     example: 3 Ikeja Avenue, Lagos
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
router.post("/", protect, authorize("admin", "cashier"), createCustomer);

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

/**
 * @swagger
 * /api/customers/{customerId}/toggle-deactivate:
 *   patch:
 *     summary: Deactivate customer (Admin only)
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
 *         description: Customer deactivated successfully
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
  "/:customerId/toggle-deactivate",
  protect,
  authorize("admin"),
 toggleDeactivate
);

/**
 * @swagger
 * /api/customers/{customerId}/delete:
 *   delete:
 *     summary: Hard delete customer (Admin only)
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
 *         description: Customer deleted successfully
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
*/
router.delete(
  "/:customerId/delete",
  protect,
  authorize("admin"),
  deleteCustomer
);



/**
 * @swagger
 * /api/customers/{customerId}/balance:
 *   get:
 *     summary: Get customer balance
 *     description: |
 *       - Admin → can view any customer balance
 *       - Cashier → can only view balances of customers they own
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/:customerId/balance",
  protect,
  authorize("admin", "cashier"),
  getCustomerBalance
);

export default router;