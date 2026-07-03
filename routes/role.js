import express from 'express'
import * as controller from '../controllers/roleController.js'
import { protect } from '../middlewares/auth.js'
import { requirePermission } from '../middlewares/permission.js'
import { PERMISSIONS } from '../utils/permissions.js'

const router = express.Router()

/**
 * @swagger
 * /api/roles/permissions:
 *   get:
 *     summary: List every permission the system understands (Admin & Super Admin)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permission catalog
 */
router.get(
  '/permissions',
  protect,
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  controller.listPermissions,
)

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: List all roles (Admin & Super Admin)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles fetched successfully
 *   post:
 *     summary: Create a new role (Admin & Super Admin)
 *     description: |
 *       Admins and Super Admins can create custom roles. An Admin cannot grant
 *       a permission they don't themselves hold, and cannot create a role with
 *       system-level powers (system.configure, users.manage.all) — those are
 *       reserved for Super Admin.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, permissions]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Loan Officer
 *               description:
 *                 type: string
 *                 example: Reviews and recommends loan applications
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [loans.review, loans.view.all, reports.generate.own]
 *     responses:
 *       201:
 *         description: Role created
 *       403:
 *         description: Attempted to grant a permission the actor doesn't hold
 */
router
  .route('/')
  .get(protect, requirePermission(PERMISSIONS.ROLES_MANAGE), controller.listRoles)
  .post(protect, requirePermission(PERMISSIONS.ROLES_MANAGE), controller.createRole)

/**
 * @swagger
 * /api/roles/{roleId}:
 *   get:
 *     summary: Get a single role by id or slug (Admin & Super Admin)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role fetched successfully
 *   patch:
 *     summary: Update a role's name, description, or permissions (Admin & Super Admin)
 *     description: System roles (Super Admin, Admin, Account Manager, Cashier) can only be edited by a Super Admin.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role updated
 *   delete:
 *     summary: Delete a custom role (Admin & Super Admin)
 *     description: System roles cannot be deleted, and a role still assigned to users cannot be deleted.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted
 */
router
  .route('/:roleId')
  .get(protect, requirePermission(PERMISSIONS.ROLES_MANAGE), controller.getRole)
  .patch(protect, requirePermission(PERMISSIONS.ROLES_MANAGE), controller.updateRole)
  .delete(protect, requirePermission(PERMISSIONS.ROLES_MANAGE), controller.deleteRole)

/**
 * @swagger
 * /api/roles/users/{userId}/assign:
 *   patch:
 *     summary: Change a staff member's role (Admin & Super Admin)
 *     description: |
 *       Only a Super Admin can assign the Super Admin role, and an actor can
 *       never assign a role with permissions beyond their own.
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Public ID of the staff member
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               roleId:
 *                 type: string
 *                 example: account_manager
 *     responses:
 *       200:
 *         description: Role assigned
 */
router.patch(
  '/users/:userId/assign',
  protect,
  requirePermission(PERMISSIONS.ROLES_ASSIGN),
  controller.assignRole,
)

export default router
