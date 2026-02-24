const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/jwt");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, age, gender, guardian } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({
      name,
      email,
      password,  // <-- FIXED: just use 'password' here
      role,
      age,
      gender,
      guardian: guardian || null,
    });

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

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
};