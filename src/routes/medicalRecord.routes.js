const express = require("express");
const router = express.Router();
const {
  uploadRecord,
  getPatientRecords,
  getAppointmentRecords,
  getRecordById,
  deleteRecord,
  getAllRecords,
} = require("../controllers/medicalRecord.controller");
const auth = require("../middleware/auth.middleware");
const { upload } = require("../config/cloudinary");

// All routes are protected
router.post("/upload", auth, upload.single("file"), uploadRecord);
router.get("/", auth, getAllRecords);
router.get("/patient/:patientId", auth, getPatientRecords);
router.get("/appointment/:appointmentId", auth, getAppointmentRecords);
router.get("/:id", auth, getRecordById);
router.delete("/:id", auth, deleteRecord);

module.exports = router;