import * as dashboardService from "../services/dashboardService.js";

export async function getAdminDashboard(req, res, next) {
  try {
    const filter = req.query.filter || "monthly";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const data = await dashboardService.getAdminDashboard({
      filter: filter,
      startDate: startDate,
      endDate: endDate,
    });

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