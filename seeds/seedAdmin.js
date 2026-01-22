const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../src/models/User");
const connectDB = require("../src/config/db");

const seedAdmin = async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const adminExists = await User.findOne({ email: "admin@healthconsult.com" });
    
    if (adminExists) {
      console.log("⚠️  Admin user already exists!");
      process.exit(0);
    }

    // Create admin user
    const adminUser = new User({
      name: "Admin User",
      email: "admin@healthconsult.com",
      password: "admin@123", // Change this in production!
      role: "admin",
      status: "active",
      isAdmin: true,
    });

    await adminUser.save();

    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: admin@healthconsult.com");
    console.log("🔐 Password: admin@123");
    console.log("⚠️  IMPORTANT: Change the password in your admin dashboard after first login!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    process.exit(1);
  }
};

seedAdmin();
