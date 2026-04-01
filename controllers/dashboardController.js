import * as dashboardService from "../services/dashboardService.js";

export async function getAdminDashboard(req, res, next) {
  try {
    const filter = req.query.filter || "monthly";

    const data = await dashboardService.getAdminDashboard(filter);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCashierDashboard(req, res, next) {
  try {
    const filter = req.query.filter || "monthly";

    const data = await dashboardService.getCashierDashboard(
      req.user._id,
      filter
    );

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}