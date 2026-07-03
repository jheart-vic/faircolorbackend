import express from "express";
import {
  createStaff,
  deleteStaffController,
  getStaffById,
  getStaff,
  transferCustomerController,
} from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/permission.js";
import { PERMISSIONS } from "../utils/permissions.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Staff (Admin, Account Manager, Cashier, and custom-role) management
 */

/**
 * @swagger
 * /api/users/staff:
 *   post:
 *     summary: Create a staff account (Admin & Super Admin)
 *     description: |
 *       Admins can create Account Managers, Cashiers, and any custom role
 *       whose permissions don't exceed their own. Only a Super Admin can
 *       create another Admin or Super Admin.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password, role]
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 description: Role id or slug (e.g. "cashier", "account_manager")
 *     responses:
 *       201:
 *         description: Staff member created
 *       403:
 *         description: Attempted to create a role beyond the actor's authority
 *   get:
 *     summary: List staff members (Admin & Super Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role id or slug
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Staff fetched successfully
 */
router
  .route("/staff")
  .post(protect, requirePermission(PERMISSIONS.USERS_MANAGE_STAFF, PERMISSIONS.USERS_MANAGE_ALL), createStaff)
  .get(protect, requirePermission(PERMISSIONS.USERS_MANAGE_STAFF, PERMISSIONS.USERS_MANAGE_ALL), getStaff);

/**
 * @swagger
 * /api/users/staff/{staffId}:
 *   get:
 *     summary: Get a staff member's profile, assigned customers, transactions, and loans (Admin & Super Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Staff member fetched successfully
 *       404:
 *         description: Staff member not found
 */
router.get(
  "/staff/:staffId",
  protect,
  requirePermission(PERMISSIONS.USERS_MANAGE_STAFF, PERMISSIONS.USERS_MANAGE_ALL),
  getStaffById
);

/**
 * @swagger
 * /api/users/transfer-customer:
 *   put:
 *     summary: Reassign a customer to a different staff member (Admin & Super Admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, newStaffId]
 *             properties:
 *               customerId:
 *                 type: string
 *               newStaffId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer transferred successfully
 *       400:
 *         description: Bad request (invalid input, already assigned, or target role can't own customers)
 *       404:
 *         description: Customer or staff member not found
 */
router.put(
  "/transfer-customer",
  protect,
  requirePermission(PERMISSIONS.USERS_MANAGE_STAFF, PERMISSIONS.USERS_MANAGE_ALL),
  transferCustomerController
);

/**
 * @swagger
 * /api/users/staff/{staffId}:
 *   delete:
 *     summary: Delete a staff account (Admin & Super Admin)
 *     description: |
 *       The staff member must have no assigned or created customers before
 *       deletion — use /transfer-customer first. The last remaining Super
 *       Admin cannot be deleted, and only a Super Admin can delete another
 *       Super Admin.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           example: "CASH_123456"
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 *       400:
 *         description: Staff member still has customers — transfer them first
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Staff member not found
 */
router.delete(
  "/staff/:staffId",
  protect,
  requirePermission(PERMISSIONS.USERS_MANAGE_STAFF, PERMISSIONS.USERS_MANAGE_ALL),
  deleteStaffController
);

export default router;
