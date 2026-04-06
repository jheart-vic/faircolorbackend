import * as dashboardService from "../services/dashboardService.js";

export async function getAdminDashboard(req, res, next) {
  try {
    const filter = req.query.filter || "monthly";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const status = req.query.status;

    const data = await dashboardService.getAdminDashboard({
      filter,
      startDate,
      endDate,
      status,
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
    const status = req.query.status;

    const data = await dashboardService.getCashierDashboard(
      req.user._id,
      filter,
      status
    );

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}
