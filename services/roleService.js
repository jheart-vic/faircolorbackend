import Role from '../models/Role.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import AppError from '../utils/appError.js'
import { ALL_PERMISSIONS, PERMISSIONS, SYSTEM_ROLE_SLUGS } from '../utils/permissions.js'
import * as notificationService from './notificationService.js'

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Both Admin and Super Admin can create/edit custom roles, but an Admin must
// never be able to grant a permission they don't themselves hold — otherwise
// an Admin could mint a role with Super-Admin-level access. Super Admin is
// exempt since it already holds every permission.
function assertNoPrivilegeEscalation(actor, permissions) {
  if (actor.role.slug === 'super_admin') return

  const actorPermissions = actor.role.permissions || []
  const overreach = permissions.filter((p) => !actorPermissions.includes(p))

  if (overreach.length) {
    throw new AppError(
      `You cannot grant permissions you don't have: ${overreach.join(', ')}`,
      403,
    )
  }
}

function assertValidPermissions(permissions = []) {
  const invalid = permissions.filter((p) => !ALL_PERMISSIONS.includes(p))
  if (invalid.length) {
    throw new AppError(`Unknown permission(s): ${invalid.join(', ')}`, 400)
  }
}

export async function listRoles() {
  return Role.find().sort({ isSystemRole: -1, name: 1 })
}

export async function getRole(roleIdOrSlug) {
  const role =
    (await Role.findById(roleIdOrSlug).catch(() => null)) ||
    (await Role.findOne({ slug: roleIdOrSlug }))

  if (!role) throw new AppError('Role not found', 404)
  return role
}

export async function createRole(payload, actor) {
  const { name, description, permissions = [] } = payload

  if (!name || !name.trim()) throw new AppError('Role name is required', 400)

  assertValidPermissions(permissions)
  assertNoPrivilegeEscalation(actor, permissions)

  // Only a Super Admin may mint another role holding system-level powers.
  if (
    actor.role.slug !== 'super_admin' &&
    (permissions.includes(PERMISSIONS.SYSTEM_CONFIGURE) ||
      permissions.includes(PERMISSIONS.USERS_MANAGE_ALL))
  ) {
    throw new AppError('Only a Super Admin can grant that permission', 403)
  }

  const slug = slugify(name)
  if (SYSTEM_ROLE_SLUGS.includes(slug)) {
    throw new AppError('That name is reserved for a system role', 400)
  }

  const existing = await Role.findOne({ $or: [{ name }, { slug }] })
  if (existing) throw new AppError('A role with that name already exists', 400)

  const role = await Role.create({
    name: name.trim(),
    slug,
    description,
    permissions,
    isSystemRole: false,
    createdBy: actor._id,
    updatedBy: actor._id,
  })

  await AuditLog.create({
    action: 'CREATE_ROLE',
    performedBy: actor._id,
    targetId: role._id,
    meta: { name: role.name, permissions },
  })

  return role
}

export async function updateRole(roleIdOrSlug, payload, actor) {
  const role = await getRole(roleIdOrSlug)

  if (role.isSystemRole && actor.role.slug !== 'super_admin') {
    throw new AppError('Only a Super Admin can edit a system role', 403)
  }

  const { name, description, permissions } = payload

  if (permissions) {
    assertValidPermissions(permissions)
    assertNoPrivilegeEscalation(actor, permissions)

    if (
      actor.role.slug !== 'super_admin' &&
      (permissions.includes(PERMISSIONS.SYSTEM_CONFIGURE) ||
        permissions.includes(PERMISSIONS.USERS_MANAGE_ALL))
    ) {
      throw new AppError('Only a Super Admin can grant that permission', 403)
    }

    role.permissions = permissions
  }

  if (name && !role.isSystemRole) {
    role.name = name.trim()
    role.slug = slugify(name)
  }

  if (description !== undefined) role.description = description
  role.updatedBy = actor._id

  await role.save()

  await AuditLog.create({
    action: 'UPDATE_ROLE',
    performedBy: actor._id,
    targetId: role._id,
    meta: { permissions: role.permissions },
  })

  return role
}

export async function deleteRole(roleIdOrSlug, actor) {
  const role = await getRole(roleIdOrSlug)

  if (role.isSystemRole) {
    throw new AppError('System roles cannot be deleted', 400)
  }

  const inUse = await User.countDocuments({ role: role._id })
  if (inUse > 0) {
    throw new AppError(
      `${inUse} user(s) still hold this role. Reassign them first.`,
      400,
    )
  }

  await role.deleteOne()

  await AuditLog.create({
    action: 'DELETE_ROLE',
    performedBy: actor._id,
    targetId: role._id,
    meta: { name: role.name },
  })
}

export async function assignRole(userId, roleIdOrSlug, actor) {
  const user =
    (await User.findOne({ publicId: userId })) ||
    (await User.findById(userId).catch(() => null))

  if (!user) throw new AppError('User not found', 404)

  const role = await getRole(roleIdOrSlug)

  // Only a Super Admin can grant the Super Admin role to someone.
  if (role.slug === 'super_admin' && actor.role.slug !== 'super_admin') {
    throw new AppError('Only a Super Admin can assign the Super Admin role', 403)
  }

  assertNoPrivilegeEscalation(actor, role.permissions)

  const previousRole = user.role
  user.role = role._id
  await user.save()

  await AuditLog.create({
    action: 'ASSIGN_ROLE',
    performedBy: actor._id,
    targetId: user._id,
    meta: { from: previousRole, to: role._id, roleName: role.name },
  })

  await notificationService.notifyUsers([user._id], {
    type: 'role.assigned',
    title: 'Your role was changed',
    message: `${actor.fullName} changed your role to ${role.name}.`,
    meta: { role: role.slug },
    relatedId: user._id,
  })

  return User.findById(user._id).populate('role').select('-password')
}
