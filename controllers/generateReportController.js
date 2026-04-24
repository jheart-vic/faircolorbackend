import * as ReportService from "../services/generateReportService.js";

export async function downloadCustomerReport(req, res, next) {
  try {
    await ReportService.generateCustomerReport(
      req.params.customerId,
      req.user,
      res,
      req.query
    );
  } catch (err) {
    next(err);
  }
}

export async function downloadCashierReport(req, res, next) {
  try {
    await ReportService.generateCashierReport(req.query, req.user, res);
  } catch (err) {
    next(err);
  }
}
export async function getCashierReport(req, res, next) {
  try {
    await ReportService.getCashierReportData(req.query, req.user, res);
  } catch (err) {
    next(err);
  }
}

export async function getCustomerReport(req, res, next) {
  try {
    await ReportService.getCustomerReportData(req.params.customerId, req.user, res, req.query);
  } catch (err) {
    next(err);
  }
}