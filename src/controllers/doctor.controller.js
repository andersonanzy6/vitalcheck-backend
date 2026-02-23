const Doctor = require("../models/Doctor");
const User = require("../models/User");

// Register doctor profile
exports.createDoctorProfile = async (req, res) => {
  try {
    const { specialization, licenseNumber, experience, bio, availability, consultationFee, clinicAddress, phone } = req.body;

    // Make sure user exists and is a doctor
    const user = await User.findById(req.user._id);
    if (!user || user.role !== "doctor")
      return res.status(403).json({ message: "Not authorized to create doctor profile" });

    // Check if doctor profile already exists
    const exists = await Doctor.findOne({ user: user._id });
    if (exists)
      return res.status(400).json({ message: "Doctor profile already exists" });

    const doctor = await Doctor.create({
      user: user._id,
      specialization,
      licenseNumber,
      experience,
      bio,
      availability,
      consultationFee,
      clinicAddress,
      phone,
    });

    res.status(201).json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all doctors (for patients)
exports.getAllDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find().populate("user", "name email");
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single doctor
exports.getDoctorById = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).populate("user", "name email");
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Update doctor profile (for logged-in doctor)
exports.updateDoctorProfile = async (req, res) => {
  try {
    const allowedFields = [
      'specialization', 'licenseNumber', 'experience',
      'bio', 'availability', 'consultationFee', 'clinicAddress', 'phone'
    ];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const doctor = await Doctor.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
