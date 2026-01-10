const express = require("express");
const router = express.Router();
const { createDoctorProfile, getAllDoctors, getDoctorById } = require("../controllers/doctor.controller");
const auth = require("../middleware/auth.middleware");

// Protected route: only logged-in doctor can create profile
router.post("/create", auth, createDoctorProfile);

// Public routes for patients
router.get("/", getAllDoctors);
router.get("/:id", getDoctorById);

module.exports = router;
