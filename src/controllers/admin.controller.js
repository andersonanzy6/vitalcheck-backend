const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Message = require("../models/Message");

// ============ USER MANAGEMENT ============
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (role) query.role = role;
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select("-password")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get user's appointments if doctor
    let appointments = [];
    if (user.role === "doctor") {
      appointments = await Appointment.find({
        doctorId: user._id,
      }).limit(5);
    }

    res.json({
      user,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!["active", "suspended", "pending", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select("-password");

    res.json({
      message: `User status updated to ${status}`,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { status: "suspended" },
      { new: true }
    ).select("-password");

    // TODO: Send email to user about suspension with reason

    res.json({
      message: "User suspended successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete user and related data
    await User.findByIdAndDelete(userId);
    // TODO: Delete related appointments, messages, medical records, etc.

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ DOCTOR MANAGEMENT ============
exports.getPendingDoctors = async (req, res) => {
  try {
    const doctors = await User.find({
      role: "doctor",
      status: "pending",
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({ doctors, count: doctors.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveDoctorRegistration = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctor = await User.findByIdAndUpdate(
      doctorId,
      { status: "active" },
      { new: true }
    ).select("-password");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // TODO: Send approval email to doctor

    res.json({
      message: "Doctor approved successfully",
      doctor,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectDoctorRegistration = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { reason } = req.body;

    const doctor = await User.findByIdAndUpdate(
      doctorId,
      { status: "rejected" },
      { new: true }
    ).select("-password");

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    // TODO: Send rejection email with reason

    res.json({
      message: "Doctor registration rejected",
      doctor,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllDoctors = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;

    let query = { role: "doctor" };

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { specialization: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const doctors = await User.find(query)
      .select("-password")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      doctors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ ANALYTICS ============
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPatients = await User.countDocuments({ role: "patient" });
    const totalDoctors = await User.countDocuments({ role: "doctor" });
    const pendingDoctors = await User.countDocuments({
      role: "doctor",
      status: "pending",
    });
    const suspendedUsers = await User.countDocuments({ status: "suspended" });

    const totalAppointments = await Appointment.countDocuments();
    const completedAppointments = await Appointment.countDocuments({
      status: "completed",
    });
    const pendingAppointments = await Appointment.countDocuments({
      status: "pending",
    });
    const cancelledAppointments = await Appointment.countDocuments({
      status: "cancelled",
    });

    const totalMessages = await Message.countDocuments();

    res.json({
      users: {
        total: totalUsers,
        patients: totalPatients,
        doctors: totalDoctors,
        pending: pendingDoctors,
        suspended: suspendedUsers,
      },
      appointments: {
        total: totalAppointments,
        completed: completedAppointments,
        pending: pendingAppointments,
        cancelled: cancelledAppointments,
      },
      messages: {
        total: totalMessages,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const newUsersLast30Days = await User.countDocuments({
      createdAt: { $gte: last30Days },
    });

    const newPatientsLast30Days = await User.countDocuments({
      role: "patient",
      createdAt: { $gte: last30Days },
    });

    const newDoctorsLast30Days = await User.countDocuments({
      role: "doctor",
      createdAt: { $gte: last30Days },
    });

    // Get users by role distribution
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get status distribution
    const statusDistribution = await User.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      newUsersLast30Days,
      newPatientsLast30Days,
      newDoctorsLast30Days,
      roleDistribution,
      statusDistribution,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAppointmentStats = async (req, res) => {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const appointmentsLast30Days = await Appointment.countDocuments({
      createdAt: { $gte: last30Days },
    });

    const statusStats = await Appointment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get appointment trends (by day for last 30 days)
    const appointmentTrends = await Appointment.aggregate([
      {
        $match: {
          createdAt: { $gte: last30Days },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      appointmentsLast30Days,
      statusStats,
      appointmentTrends,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ SYSTEM MANAGEMENT ============
exports.getSystemSettings = async (req, res) => {
  try {
    // TODO: Implement settings model/collection
    const settings = {
      appName: "Health Consultant",
      defaultConsultationFee: 100,
      maxAppointmentDuration: 60,
      minAppointmentInterval: 15,
      doctorApprovalRequired: true,
      enableAIChat: true,
    };

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSystemSettings = async (req, res) => {
  try {
    // TODO: Implement settings model/collection
    const settings = req.body;

    res.json({
      message: "System settings updated",
      settings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ REPORTS & MODERATION ============
exports.getActivityLog = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Get recent appointments and messages as activity
    const recentAppointments = await Appointment.find()
      .populate("patientId", "name")
      .populate("doctorId", "name")
      .select("patientId doctorId status createdAt")
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });

    res.json({
      activity: recentAppointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
