import * as transactionService from "../services/transactionService.js";

export async function createDepositController(req, res, next) {
  try {
    const data = await transactionService.createDeposit(
      req.body,
      req.user._id
    );

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createWithdrawalController(req, res, next) {
  try {
    const data = await transactionService.createWithdrawal(
      req.body,
      req.user._id
    );

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function approveTransactionController(req, res, next) {
  try {
    const data = await transactionService.approveTransaction(
      req.params.transactionId,
      req.user._id
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getTransactionsController(req, res, next) {
  try {
    const data = await transactionService.getTransactions(req.query);

    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
}