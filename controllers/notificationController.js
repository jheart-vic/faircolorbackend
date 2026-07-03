import * as notificationService from '../services/notificationService.js'

export async function listNotifications(req, res, next) {
    try {
        const data = await notificationService.listNotifications(req.user._id, req.query)
        res.json({ success: true, ...data })
    } catch (err) {
        next(err)
    }
}

export async function getUnreadCount(req, res, next) {
    try {
        const data = await notificationService.getUnreadCount(req.user._id)
        res.json({ success: true, ...data })
    } catch (err) {
        next(err)
    }
}

export async function markAsRead(req, res, next) {
    try {
        const data = await notificationService.markAsRead(req.params.notificationId, req.user._id)
        res.json({ success: true, data })
    } catch (err) {
        next(err)
    }
}

export async function markAllAsRead(req, res, next) {
    try {
        const data = await notificationService.markAllAsRead(req.user._id)
        res.json({ success: true, message: 'All notifications marked as read', ...data })
    } catch (err) {
        next(err)
    }
}
