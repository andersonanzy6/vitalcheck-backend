const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      const error = "CRITICAL: MONGO_URI environment variable is not set!";
      console.error(error);
      throw new Error(error);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("CRITICAL: Make sure MONGO_URI is set in Render environment variables");
    process.exit(1);
  }
};

module.exports = connectDB;
