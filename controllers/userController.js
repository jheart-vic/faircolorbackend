import * as userService from "../services/userService.js";

export async function createStaff(req, res, next) {
  try {
    const data = await userService.createStaff(req.body, req.user);

    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStaff(req, res, next) {
    try {
        const data = await userService.getStaff(req.query)
        res.status(200).json({ success: true, ...data })
    } catch (err) {
        next(err)
    }
}

export async function getStaffById(req, res, next) {
    try {
        const data = await userService.getStaffById(req.params.staffId, req.query)
        res.status(200).json({ success: true, data })
    } catch (err) {
        next(err)
    }
}

export async function transferCustomerController(req, res, next) {
  try {
    const { customerId, newStaffId } = req.body;

    const result = await userService.transferCustomer(
      customerId,
      newStaffId,
      req.user._id
    );

    res.json({
      success: true,
      message: "Customer transferred successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteStaffController(req, res, next) {
    try {
        await userService.deleteStaff(req.params.staffId, req.user)
        res.status(200).json({ success: true, message: 'Staff member deleted successfully' })
    } catch (err) {
        next(err)
    }
}
