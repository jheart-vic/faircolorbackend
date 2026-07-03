import express from 'express'
import * as controller from '../controllers/notificationController.js'
import { protect } from '../middlewares/auth.js'

const router = express.Router()

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: In-app notifications (pending approvals, recommendations, role changes)
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: List the current user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
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
 *         description: Notifications fetched successfully
 */
router.get('/', protect, controller.listNotifications)

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get the current user's unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count fetched successfully
 */
router.get('/unread-count', protect, controller.getUnreadCount)

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all of the current user's notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch('/read-all', protect, controller.markAllAsRead)

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.patch('/:notificationId/read', protect, controller.markAsRead)

export default router
