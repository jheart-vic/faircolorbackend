import * as customerService from "../services/customerService.js";

export async function createCustomer(req, res, next) {
  try {
    const data = await customerService.createCustomer(
      req.body,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: "Customer created successfully (pending approval)",
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function approveCustomer(req, res, next) {
  try {
    const data = await customerService.approveCustomer(
      req.params.customerId,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Customer approved successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCustomers(req, res, next) {
  try {
    const { status, accountStatus } = req.query

    const validAccountStatus = ['active', 'deactivated']
    const validApprovalStatus = ['pending', 'approved']

    if (accountStatus && !validAccountStatus.includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid accountStatus. Use "active" or "deactivated"',
      })
    }

    if (status && !validApprovalStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use "pending" or "approved"',
      })
    }

    const data = await customerService.getCustomers(
      req.query,
      req.user
    )

    res.json({
      success: true,
      ...data,
    })
  } catch (err) {
    next(err)
  }
}
export async function getCustomerBalance(req, res, next) {
  try {
    const data = await customerService.getCustomerBalanceByPublicId(
      req.params.customerId,
      req.user
    );

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleDeactivate(req, res, next) {
  try {
    const customer = await customerService.toggleCustomerDeactivation(
      req.params.customerId,
      req.user
    );

    res.json({
      success: true,
      message: customer.isDeactivated
        ? "Customer deactivated"
        : "Customer restored",
      data: customer,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomer(req, res, next) {
  try {
    const data = await customerService.deleteCustomer(
      req.params.customerId,
      req.user._id
    );
res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
}