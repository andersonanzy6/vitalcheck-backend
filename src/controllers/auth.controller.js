const User = require("../models/User");
const Doctor = require("../models/Doctor");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const generateToken = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../utils/emailService");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, age, gender, guardian, phone, specialization, licenseNumber, experience, placeOfWork, location } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    // Handle File Uploads for Registration
    let profileImageUrl = null;
    let licenseDocumentUrl = null;

    if (req.files) {
      if (req.files.profileImage && req.files.profileImage[0]) {
        profileImageUrl = req.files.profileImage[0].path;
      }
      if (req.files.licenseUpload && req.files.licenseUpload[0]) {
        licenseDocumentUrl = req.files.licenseUpload[0].path;
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      age,
      gender,
      phone: phone || "",
      profileImage: profileImageUrl,
      guardian: guardian || null,
      status: role === "doctor" ? "pending" : "active",
    });

    if (role === "doctor") {
      await Doctor.create({
        user: user._id,
        specialization: specialization || "",
        licenseNumber: licenseNumber || "",
        experience: experience || 0,
        placeOfWork: placeOfWork || "",
        location: location || "",
        licenseDocumentUrl: licenseDocumentUrl || "",
        phone: phone || "",
        verificationStatus: "pending",
      });
    }

    res.status(201).json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // do not reveal whether user exists
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const frontEndUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetLink = `${frontEndUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(user.email, resetLink);

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Unable to process password reset request.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).json({ message: 'Invalid token or user not found' });
    }

    user.password = password;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });
    }
    res.status(500).json({ message: 'Unable to reset password.' });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const response = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      age: user.age,
      gender: user.gender,
      bio: user.bio,
      phone: user.phone,
      address: user.address,
      medicalHistory: user.medicalHistory,
      bloodGroup: user.bloodGroup,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
    };

    if (user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: user._id });
      if (doctor) {
        response.doctorProfile = doctor;
      }
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.error("Auth Error: req.user is missing", { user: req.user });
      return res.status(401).json({ message: "Authentication failed. Please login again." });
    }

    const {
      name, age, gender, bio,
      phone, address, medicalHistory, bloodGroup
    } = req.body;

    // Find user by ID from token
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Handle File Uploads
    if (req.files) {
      if (req.files.profileImage && req.files.profileImage[0]) {
        user.profileImage = req.files.profileImage[0].path;
        user.cloudinaryImageId = req.files.profileImage[0].filename;
      }
      if (req.files.coverImage && req.files.coverImage[0]) {
        user.coverImage = req.files.coverImage[0].path;
        user.cloudinaryCoverId = req.files.coverImage[0].filename;
      }
    }

    // Only allow updating certain fields
    if (name) user.name = name;
    if (age !== undefined) user.age = age;
    if (gender) user.gender = gender;
    if (bio !== undefined) user.bio = bio;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (medicalHistory !== undefined) user.medicalHistory = medicalHistory;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        age: user.age,
        gender: user.gender,
        bio: user.bio,
        phone: user.phone,
        address: user.address,
        medicalHistory: user.medicalHistory,
        bloodGroup: user.bloodGroup,
        profileImage: user.profileImage,
        coverImage: user.coverImage,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ 
      message: error.message || "Failed to update profile",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};