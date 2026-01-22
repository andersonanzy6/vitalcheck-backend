const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const {
  getAllUsers,
  getUserById,
  updateUserStatus,
  suspendUser,
  deleteUser,
  getPendingDoctors,
  approveDoctorRegistration,
  rejectDoctorRegistration,
  getAllDoctors,
  getDashboardStats,
  getUserStats,
  getAppointmentStats,
  getSystemSettings,
  updateSystemSettings,
  getActivityLog,
} = require("../controllers/admin.controller");

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// All routes protected by auth + admin check
router.use(auth);
router.use(isAdmin);

// ============ USER MANAGEMENT ============
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.put("/users/:userId/status", updateUserStatus);
router.post("/users/:userId/suspend", suspendUser);
router.delete("/users/:userId", deleteUser);

// ============ DOCTOR MANAGEMENT ============
router.get("/doctors/pending", getPendingDoctors);
router.post("/doctors/:doctorId/approve", approveDoctorRegistration);
router.post("/doctors/:doctorId/reject", rejectDoctorRegistration);
router.get("/doctors", getAllDoctors);

// ============ ANALYTICS ============
router.get("/stats/dashboard", getDashboardStats);
router.get("/stats/users", getUserStats);
router.get("/stats/appointments", getAppointmentStats);

// ============ SYSTEM MANAGEMENT ============
router.get("/settings", getSystemSettings);
router.put("/settings", updateSystemSettings);

// ============ REPORTS & MODERATION ============
router.get("/activity-log", getActivityLog);

module.exports = router;
