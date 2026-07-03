import AppError from '../utils/appError.js'

/**
 * Grants access if the authenticated user's role has AT LEAST ONE of the
 * given permissions. Use this on routes, and let the service layer apply
 * any finer-grained checks (e.g. approval-tier amount checks, ownership).
 */
export function requirePermission(...permissions) {
  return (req, res, next) => {
    const user = req.user

    if (!user?.role) {
      return next(new AppError('Not authorized, no role assigned', 403))
    }

    const userPermissions = user.role.permissions || []
    const allowed = permissions.some((p) => userPermissions.includes(p))

    if (!allowed) {
      return next(new AppError('Access Forbidden and Denied', 403))
    }

    next()
  }
}

/**
 * Grants access only if the authenticated user's role has ALL of the given
 * permissions.
 */
export function requireAllPermissions(...permissions) {
  return (req, res, next) => {
    const user = req.user

    if (!user?.role) {
      return next(new AppError('Not authorized, no role assigned', 403))
    }

    const userPermissions = user.role.permissions || []
    const allowed = permissions.every((p) => userPermissions.includes(p))

    if (!allowed) {
      return next(new AppError('Access Forbidden and Denied', 403))
    }

    next()
  }
}

/**
 * Restricts a route to specific role slugs. Reserved for the rare case
 * where behaviour must be tied to a literal role rather than a capability
 * (e.g. protecting the Super Admin bootstrap role itself). Prefer
 * requirePermission everywhere else so custom roles keep working.
 */
export function requireRoleSlug(...slugs) {
  return (req, res, next) => {
    if (!slugs.includes(req.user?.role?.slug)) {
      return next(new AppError('Access Forbidden and Denied', 403))
    }
    next()
  }
}
