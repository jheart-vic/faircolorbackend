import User from "../models/User.js";
import { generateToken } from "../utils/token.js";

export async function loginUser(payload) {
  const email = String(payload.email).trim().toLowerCase();
  const password = String(payload.password);

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new Error("Invalid email or password");
  }
if(!user.role){
    throw new Error("Access denied");
}

  if (!user.isActive) {
    throw new Error("Account is disabled");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user);

  return {
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      role: user.role,
    },
  };
}
