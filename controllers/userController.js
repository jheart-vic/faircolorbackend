import * as userService from "../services/userService.js";

export async function createCashier(req, res, next) {
  try {
    const data = await userService.createCashier(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Cashier created successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCashiers(req, res, next) {
  try {
    const data = await userService.getCashiers(req.query);

    res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
}
