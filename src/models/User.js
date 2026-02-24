const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    role: {
      type: String,
      enum: ["patient", "doctor", "parent", "admin"],
      default: "patient",
    },

    status: {
      type: String,
      enum: ["active", "suspended", "pending", "rejected"],
      default: "active",
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    age: Number,
    gender: String,

    guardian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    bio: {
      type: String,
      default: "",
    },

    profileImage: {
      type: String,
      default: null, // URL to Cloudinary image
    },

    cloudinaryImageId: {
      type: String,
      default: null, // Cloudinary public_id for deletion
    },

    coverImage: {
      type: String,
      default: null, // URL to Cloudinary image
    },

    cloudinaryCoverId: {
      type: String,
      default: null, // Cloudinary public_id for deletion
    },

    phone: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
    },

    medicalHistory: {
      type: String,
      default: "",
    },

    bloodGroup: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

/* Hash password before saving */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

/* Compare passwords during login */
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
