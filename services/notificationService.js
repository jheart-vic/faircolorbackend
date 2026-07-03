import Notification from '../models/Notification.js'
import Role from '../models/Role.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'

// ── Creation helpers ─────────────────────────────────────────────────────────

// Create the same notification for an explicit list of user ids.
export async function notifyUsers(userIds, { type, title, message, meta = {}, relatedId }) {
    const uniqueIds = [...new Set(userIds.map((id) => id.toString()))]
    if (!uniqueIds.length) return []

    const docs = uniqueIds.map((recipient) => ({
        recipient,
        type,
        title,
        message,
        meta,
        relatedId,
    }))

    return Notification.insertMany(docs)
}

// Create a notification for every active staff member whose role holds the
// given permission — used for approval-tier fan-out (e.g. every Super Admin
// gets notified when a tier-2 transaction needs approval).
export async function notifyByPermission(permission, payload, { excludeUserId } = {}) {
    const roles = await Role.find({ permissions: permission }).select('_id')
    if (!roles.length) return []

    const roleIds = roles.map((r) => r._id)
    const filter = { role: { $in: roleIds }, isActive: true }
    if (excludeUserId) filter._id = { $ne: excludeUserId }

    const users = await User.find(filter).select('_id')
    return notifyUsers(
        users.map((u) => u._id),
        payload,
    )
}

// ── Inbox operations ─────────────────────────────────────────────────────────

export async function listNotifications(userId, query = {}) {
    const { page = 1, limit = 20, unreadOnly } = query
    const filter = { recipient: userId }
    if (unreadOnly === 'true' || unreadOnly === true) filter.isRead = false

    const skip = (page - 1) * limit

    const [data, total, unreadCount] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipient: userId, isRead: false }),
    ])

    return {
        data,
        unreadCount,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit),
        },
    }
}

export async function getUnreadCount(userId) {
    const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
    })
    return { unreadCount }
}

export async function markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
    })
    if (!notification) throw new AppError('Notification not found', 404)

    notification.isRead = true
    notification.readAt = new Date()
    await notification.save()

    return notification
}

export async function markAllAsRead(userId) {
    const result = await Notification.updateMany(
        { recipient: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } },
    )
    return { modifiedCount: result.modifiedCount }
}
