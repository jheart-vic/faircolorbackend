import express from 'express';
import authRouter from './auth.js';
import userRouter from './user.js';
import transactionRouter from './transaction.js';
import customerRouter from './customer.js';
import loanRouter from './loan.js';
import dashboardRouter from './dashboard.js';
import reportRouter from './report.js';
import roleRouter from './role.js';
import notificationRouter from './notification.js';

const router = express.Router();
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/roles", roleRouter);
router.use("/transactions", transactionRouter);
router.use("/customers", customerRouter);
router.use("/loans", loanRouter);
router.use("/dashboard", dashboardRouter);
router.use("/reports", reportRouter);
router.use("/notifications", notificationRouter);



export default router;