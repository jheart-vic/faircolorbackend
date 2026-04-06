import express from "express";
import { login, refresh, logout } from "../controllers/authController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login (Admin or Cashier)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@faircolours.com
 *               password:
 *                 type: string
 *                 example: 123456
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             description: Refresh token cookie
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Login successful
 *               accessToken: "jwt-token"
 *               user:
 *                 id: "123"
 *                 fullName: "John Doe"
 *                 email: "admin@faircolours.com"
 *                 role: "admin"
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New access token issued
 *         headers:
 *           Set-Cookie:
 *             description: New refresh token cookie
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               accessToken: "new-jwt-token"
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post("/refresh", refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Logged out
 */
router.post("/logout", logout);

export default router;