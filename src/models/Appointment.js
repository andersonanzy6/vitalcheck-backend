const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },

    appointmentDate: {
      type: Date,
      required: true,
    },

    appointmentTime: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },

    consultationType: {
      type: String,
      enum: ["video", "audio", "chat"],
      required: true,
    },

    reasonForVisit: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },

    prescription: {
      type: String,
      default: "",
    },

    duration: {
      type: Number,
      default: 30, // minutes
    },

    cancelledBy: {
      type: String,
      enum: ["patient", "doctor", null],
      default: null,
    },

    cancelReason: {
      type: String,
      default: "",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);