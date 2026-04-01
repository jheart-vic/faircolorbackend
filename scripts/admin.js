import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

async function seedAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ role: "admin" });

  if (existing) {
    console.log("Admin already exists");
    process.exit();
  }

  await User.create({
    name: "Super Admin",
    email: "admin@faircolours.com",
    password: "123456",
    role: "admin",
  });

  console.log("Admin created");
  process.exit();
}

seedAdmin();