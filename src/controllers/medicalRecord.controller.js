const MedicalRecord = require("../models/MedicalRecord");
const { cloudinary } = require("../config/cloudinary");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

// Get all medical records (for authenticated users - patients see their own, doctors see their patients')
exports.getAllRecords = async (req, res) => {
  try {
    let records;

    if (req.user.role === "patient") {
      // Patients can only see their own records
      records = await MedicalRecord.find({ patient: req.user._id })
        .populate("uploadedBy", "name email role")
        .populate("appointment")
        .sort({ createdAt: -1 });
    } else if (req.user.role === "doctor") {
      // Doctors can see records of patients they have appointments with
      const doctorProfile = await Doctor.findOne({ user: req.user._id });
      if (doctorProfile) {
        // Get all appointments for this doctor
        const Appointment = require("../models/Appointment");
        const appointments = await Appointment.find({ doctor: doctorProfile._id }).distinct("patient");

        // Get records for those patients
        records = await MedicalRecord.find({ patient: { $in: appointments } })
          .populate("uploadedBy", "name email role")
          .populate("appointment")
          .populate("patient", "name email")
          .sort({ createdAt: -1 });
      } else {
        return res.status(404).json({ message: "Doctor profile not found" });
      }
    } else if (req.user.role === "admin") {
      // Admins can see all records
      records = await MedicalRecord.find()
        .populate("uploadedBy", "name email role")
        .populate("appointment")
        .populate("patient", "name email")
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Upload a medical record
exports.uploadRecord = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { patientId, appointmentId, recordType, title, description } = req.body;

    let finalPatientId;

    // If user is a patient, they can only upload for themselves
    if (req.user.role === "patient") {
      finalPatientId = req.user._id;
    } else if (req.user.role === "doctor") {
      // Doctor must provide patientId
      if (!patientId) {
        return res.status(400).json({ message: "patientId is required for doctors" });
      }
      const patient = await User.findById(patientId);
      if (!patient || patient.role !== "patient") {
        return res.status(404).json({ message: "Patient not found" });
      }
      finalPatientId = patientId;
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }

    const record = await MedicalRecord.create({
      patient: finalPatientId,
      appointment: appointmentId || null,
      uploadedBy: req.user._id,
      recordType,
      title,
      description,
      fileUrl: req.file.path, // Cloudinary URL
      fileType: req.file.mimetype,
      cloudinaryId: req.file.filename, // Cloudinary public_id
    });

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all medical records for a patient
exports.getPatientRecords = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Authorization: patient can view their own, doctor can view their patients'
    if (req.user.role === "patient" && patientId !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const records = await MedicalRecord.find({ patient: patientId })
      .populate("uploadedBy", "name email role")
      .populate("appointment")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get records for a specific appointment
exports.getAppointmentRecords = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const records = await MedicalRecord.find({ appointment: appointmentId })
      .populate("uploadedBy", "name email role")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single record by ID
exports.getRecordById = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate("patient", "name email")
      .populate("uploadedBy", "name email role")
      .populate("appointment");

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Authorization check
    const isPatient = record.patient._id.toString() === req.user._id.toString();
    const doctorProfile = await Doctor.findOne({ user: req.user._id });
    const isDoctor = req.user.role === "doctor" && doctorProfile;

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ message: "Not authorized" });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a medical record
exports.deleteRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Only the person who uploaded it can delete
    if (record.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this record" });
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(record.cloudinaryId);

    // Delete from database
    await record.deleteOne();

    res.json({ message: "Record deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};