const mongoose = require("mongoose");

const callSessionSchema = new mongoose.Schema(
    {
        consultation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Consultation",
            required: true,
        },
        caller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        receiver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["audio", "video"],
            default: "video",
        },
        status: {
            type: String,
            enum: ["started", "ended", "missed"],
            default: "started",
        },
        startTime: {
            type: Date,
            default: Date.now,
        },
        endTime: {
            type: Date,
        },
        duration: {
            type: Number, // duration in seconds
        },
        roomName: {
            type: String, // For Agora/Twilio/WebRTC
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("CallSession", callSessionSchema);
