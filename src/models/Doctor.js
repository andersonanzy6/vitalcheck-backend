const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // each doctor maps to one User
    },

    specialization: {
      type: String,
      required: true,
    },

    licenseNumber: {
      type: String,
      required: true,
      unique: true,
    },

    experience: {
      type: Number, // years of experience
      required: true,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    bio: {
      type: String,
      default: "",
    },

    availability: [
      {
        day: { type: String }, // e.g. "Monday"
        from: { type: String }, // "09:00"
        to: { type: String }, // "17:00"
      },
    ],
    consultationFee: {
      type: Number,
      default: null,
    },

    clinicAddress: {
      type: String,
      default: '',
    },

    phone: {
      type: String,
      default: '',
    },

    licenseDocumentUrl: {
      type: String,
      default: '',
    },

    placeOfWork: {
      type: String,
      default: '',
    },

    location: {
      type: String,
      default: '',
    },

    isOnline: {
      type: Boolean,
      default: false,
    },

    verificationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", doctorSchema);
