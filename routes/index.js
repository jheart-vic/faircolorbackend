import express from 'express';
import authRouter from './auth.js';
import userRouter from './user.js';
import transactionRouter from './transaction.js';
import customerRouter from './customer.js';
import loanRouter from './loan.js';

const router = express.Router();
// router.use("/admin", adminRouter);
router.use("/auth", authRouter);
router.use("/users", userRouter);
router.use("/transactions", transactionRouter);
router.use("/customers", customerRouter);
router.use("/loans", loanRouter);



export default router;