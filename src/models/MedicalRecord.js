const mongoose = require("mongoose");

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null, // can be null if it's a general record
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // who uploaded it (patient or doctor)
    },

    recordType: {
      type: String,
      enum: ["lab_result", "prescription", "medical_image", "report", "other"],
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    fileUrl: {
      type: String,
      required: true, // Cloudinary URL
    },

    fileType: {
      type: String, // e.g., "image/jpeg", "application/pdf"
      required: true,
    },

    cloudinaryId: {
      type: String,
      required: true, // for deleting files from Cloudinary
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MedicalRecord", medicalRecordSchema);