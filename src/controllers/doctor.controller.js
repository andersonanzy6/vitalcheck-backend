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

// Get a single doctor - by doctor ID or user ID
exports.getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    let doctor;
    
    // Try to find by Doctor ID first
    doctor = await Doctor.findById(id).populate("user", "name email isOnline");
    
    // If not found, try to find by User ID
    if (!doctor) {
      doctor = await Doctor.findOne({ user: id }).populate("user", "name email isOnline");
    }
    
    // If still not found, return just user info
    if (!doctor) {
      const User = require("../models/User");
      const user = await User.findById(id).select("name email isOnline");
      
      if (!user) {
        return res.status(404).json({ message: "Doctor and User not found" });
      }
      
      // Return basic user info as fallback
      return res.json({
        _id: user._id,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isOnline: user.isOnline || false
        },
        isOnline: user.isOnline || false,
        lastSeen: new Date(),
        role: user.role
      });
    }
    
    // Return doctor with online status
    const doctorData = doctor.toObject();
    doctorData.isOnline = doctor.user?.isOnline || false;
    doctorData.lastSeen = doctor.lastSeen;
    
    res.json(doctorData);
  } catch (error) {
    console.error('Error fetching doctor:', error);
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
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('user', 'name email');

    if (!doctor) return res.status(404).json({ message: "Doctor profile not found" });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
