const express = require("express");
const router = express.Router();
const {
  createAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
  rescheduleAppointment,
} = require("../controllers/appointment.controller");
const auth = require("../middleware/auth.middleware");

// All appointment routes are protected
router.post("/create", auth, createAppointment);
router.get("/my-appointments", auth, getMyAppointments);
router.get("/:id", auth, getAppointmentById);
router.patch("/:id/status", auth, updateAppointmentStatus);
router.put("/:id/reschedule", auth, rescheduleAppointment);
router.delete("/:id", auth, deleteAppointment);

module.exports = router;