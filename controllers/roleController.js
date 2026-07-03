import * as roleService from '../services/roleService.js'
import { ALL_PERMISSIONS } from '../utils/permissions.js'

export async function listPermissions(req, res, next) {
  try {
    res.json({ success: true, data: ALL_PERMISSIONS })
  } catch (err) {
    next(err)
  }
}

export async function listRoles(req, res, next) {
  try {
    const data = await roleService.listRoles()
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function getRole(req, res, next) {
  try {
    const data = await roleService.getRole(req.params.roleId)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
}

export async function createRole(req, res, next) {
  try {
    const data = await roleService.createRole(req.body, req.user)
    res.status(201).json({ success: true, message: 'Role created successfully', data })
  } catch (err) {
    next(err)
  }
}

export async function updateRole(req, res, next) {
  try {
    const data = await roleService.updateRole(req.params.roleId, req.body, req.user)
    res.json({ success: true, message: 'Role updated successfully', data })
  } catch (err) {
    next(err)
  }
}

export async function deleteRole(req, res, next) {
  try {
    await roleService.deleteRole(req.params.roleId, req.user)
    res.json({ success: true, message: 'Role deleted successfully' })
  } catch (err) {
    next(err)
  }
}

export async function assignRole(req, res, next) {
  try {
    const { roleId } = req.body
    const data = await roleService.assignRole(req.params.userId, roleId, req.user)
    res.json({ success: true, message: 'Role assigned successfully', data })
  } catch (err) {
    next(err)
  }
}
