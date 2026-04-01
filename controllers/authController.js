import * as authService from "../services/authService.js";

export async function login(req, res, next) {
  try {
    const data = await authService.loginUser(req.body);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data,
    });
  } catch (err) {
    next(err);
  }
}