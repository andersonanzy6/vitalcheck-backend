const mongoose = require("mongoose");

const consultationSchema = new mongoose.Schema(
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
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
            required: true,
        },
        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            required: true,
        },
        status: {
            type: String,
            enum: ["scheduled", "in-progress", "completed", "cancelled"],
            default: "scheduled",
        },
        startTime: {
            type: Date,
        },
        endTime: {
            type: Date,
        },
        notes: {
            type: String,
            default: "",
        },
        diagnosis: {
            type: String,
            default: "",
        },
        prescription: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Consultation", consultationSchema);
