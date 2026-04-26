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
        const data = await userService.getCashiers(req.query)
        res.status(200).json({ success: true, ...data })
    } catch (err) {
        next(err)
    }
}

export async function getCashierById(req, res, next) {
    try {
        const data = await userService.getCashierById(req.params.cashierId, req.query)
        res.status(200).json({ success: true, data })
    } catch (err) {
        next(err)
    }
}

export async function transferCustomerController(req, res) {
  const { customerId, newCashierId } = req.body;

  const result = await userService.transferCustomer(
    customerId,
    newCashierId,
    req.user._id
  );

  res.json({
    message: "Customer transferred successfully",
    data: result,
  });
}

export async function deleteCashierController(req, res, next) {
    try {
        await userService.deleteCashier(req.params.cashierId, req.user._id)
        res.status(200).json({ success: true, message: 'Cashier deleted successfully' })
    } catch (err) {
        next(err)
    }
}