import * as loanService from "../services/loanService.js";

export async function createLoanController(req, res, next) {
  try {
    const data = await loanService.createLoan(
      req.body,
      req.user._id
    );

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function approveLoan(req, res, next) {
  try {
    const data = await loanService.approveLoan(
      req.params.loanId,
      req.user._id
    );

    res.json({
      success: true,
      message: "Loan approved and disbursed",
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectLoan(req, res, next) {
  try {
    const data = await loanService.rejectLoan(
      req.params.loanId,
      req.user._id
    );
    res.json({
      success: true,
      message: "Loan rejected successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLoans(req, res, next) {
  try {
    const data = await loanService.getLoans(req.query);

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
}