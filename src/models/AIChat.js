const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "Health Consultation",
    },
    messages: [messageSchema],
    topic: {
      type: String,
      default: "general", // e.g., "symptoms", "general", "medication", etc.
    },
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Index for faster queries
aiChatSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("AIChat", aiChatSchema);
