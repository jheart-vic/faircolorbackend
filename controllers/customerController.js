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
    const data = await customerService.getCustomers(req.query);

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
}

