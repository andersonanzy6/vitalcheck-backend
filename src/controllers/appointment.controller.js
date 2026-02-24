const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const User = require("../models/User");
const { createNotification } = require("./notification.controller");
const {
  sendAppointmentConfirmation,
  sendDoctorNotification,
  sendCancellationEmail,
} = require("../utils/emailService");

// Create a new appointment (Patient)
exports.createAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      appointmentDate,
      appointmentTime,
      consultationType,
      reasonForVisit,
    } = req.body;

    // Check if doctor exists
    const doctor = await Doctor.findById(doctorId).populate("user");
    if (!doctor)
      return res.status(404).json({ message: "Doctor not found" });

    // Check if doctor has an associated user profile
    if (!doctor.user) {
      return res.status(404).json({ message: "Doctor's user profile not found" });
    }

    // Check if user is a patient
    if (req.user.role !== "patient")
      return res
        .status(403)
        .json({ message: "Only patients can book appointments" });

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: doctorId,
      appointmentDate,
      appointmentTime,
      consultationType,
      reasonForVisit,
    });

    // Send email to doctor (non-blocking side effect)
    sendDoctorNotification(doctor.user.email, {
      patientName: req.user.name,
      date: new Date(appointmentDate).toLocaleDateString(),
      time: appointmentTime,
      consultationType,
      reason: reasonForVisit || "Not specified",
    }).catch(err => console.error("Email notification failed:", err));

    // Create in-app notification for doctor (non-blocking side effect)
    createNotification({
      recipient: doctor.user._id,
      sender: req.user._id,
      type: "appointment_booked",
      title: "New Appointment Request",
      message: `${req.user.name} has booked an appointment with you on ${new Date(
        appointmentDate
      ).toLocaleDateString()} at ${appointmentTime}`,
      relatedAppointment: appointment._id,
    }).catch(err => console.error("In-app notification failed:", err));

    res.status(201).json(appointment);
  } catch (error) {
    console.error("DEBUG - Create Appointment Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all appointments for logged-in user (patient or doctor)
exports.getMyAppointments = async (req, res) => {
  try {
    let appointments;

    if (req.user.role === "patient") {
      appointments = await Appointment.find({ patient: req.user._id })
        .populate("doctor")
        .populate({
          path: "doctor",
          populate: { path: "user", select: "name email" },
        });
    } else if (req.user.role === "doctor") {
      // Find the doctor profile for this user
      const doctorProfile = await Doctor.findOne({ user: req.user._id });
      if (!doctorProfile)
        return res.status(404).json({ message: "Doctor profile not found" });

      appointments = await Appointment.find({ doctor: doctorProfile._id })
        .populate("patient", "name email age gender");
    } else {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patient", "name email age gender")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // Check if user is authorized to view this appointment
    const doctorProfile = await Doctor.findOne({ user: req.user._id });
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = doctorProfile && appointment.doctor._id.toString() === doctorProfile._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ message: "Not authorized to view this appointment" });
    }

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update appointment status (Doctor can confirm/complete, Patient/Doctor can cancel)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status, notes, prescription, cancelReason } = req.body;

    const appointment = await Appointment.findById(req.params.id)
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // Authorization check
    const doctorProfile = await Doctor.findOne({ user: req.user._id });
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = doctorProfile && appointment.doctor._id.toString() === doctorProfile._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only doctors can confirm or complete appointments
    if ((status === "confirmed" || status === "completed") && !isDoctor) {
      return res
        .status(403)
        .json({ message: "Only doctors can confirm or complete appointments" });
    }

    const previousStatus = appointment.status;

    // Handle cancellation
    if (status === "cancelled") {
      appointment.status = "cancelled";
      appointment.cancelledBy = req.user.role;
      appointment.cancelReason = cancelReason || "";

      // Send cancellation emails (non-blocking)
      sendCancellationEmail(appointment.patient.email, {
        doctorName: appointment.doctor.user.name,
        date: new Date(appointment.appointmentDate).toLocaleDateString(),
        time: appointment.appointmentTime,
        cancelledBy: req.user.role,
        reason: cancelReason,
      }).catch(err => console.error("Cancellation email failed:", err));

      if (isPatient) {
        sendCancellationEmail(appointment.doctor.user.email, {
          doctorName: appointment.patient.name,
          date: new Date(appointment.appointmentDate).toLocaleDateString(),
          time: appointment.appointmentTime,
          cancelledBy: "patient",
          reason: cancelReason,
        }).catch(err => console.error("Cancellation email to doctor failed:", err));
      }

      // Create in-app notifications (non-blocking)
      const recipientId = isPatient ? appointment.doctor.user._id : appointment.patient._id;
      createNotification({
        recipient: recipientId,
        sender: req.user._id,
        type: "appointment_cancelled",
        title: "Appointment Cancelled",
        message: `Appointment on ${new Date(
          appointment.appointmentDate
        ).toLocaleDateString()} at ${appointment.appointmentTime} has been cancelled`,
        relatedAppointment: appointment._id,
      }).catch(err => console.error("Cancellation notification failed:", err));
    } else {
      appointment.status = status;

      // Send confirmation email when doctor confirms (non-blocking)
      if (status === "confirmed" && previousStatus === "pending") {
        sendAppointmentConfirmation(appointment.patient.email, {
          doctorName: appointment.doctor.user.name,
          date: new Date(appointment.appointmentDate).toLocaleDateString(),
          time: appointment.appointmentTime,
          consultationType: appointment.consultationType,
        }).catch(err => console.error("Confirmation email failed:", err));

        // Create in-app notification for patient (non-blocking)
        createNotification({
          recipient: appointment.patient._id,
          sender: req.user._id,
          type: "appointment_confirmed",
          title: "Appointment Confirmed",
          message: `Dr. ${appointment.doctor.user.name} has confirmed your appointment on ${new Date(
            appointment.appointmentDate
          ).toLocaleDateString()} at ${appointment.appointmentTime}`,
          relatedAppointment: appointment._id,
        }).catch(err => console.error("Confirmation notification failed:", err));
      }

      // Notify patient when appointment is completed (non-blocking)
      if (status === "completed" && previousStatus !== "completed") {
        createNotification({
          recipient: appointment.patient._id,
          sender: req.user._id,
          type: "appointment_completed",
          title: "Appointment Completed",
          message: `Your appointment with Dr. ${appointment.doctor.user.name} has been completed`,
          relatedAppointment: appointment._id,
        }).catch(err => console.error("Completion notification failed:", err));
      }
    }

    // Doctors can add notes and prescriptions
    if (isDoctor) {
      if (notes) appointment.notes = notes;
      if (prescription) {
        appointment.prescription = prescription;

        // Notify patient about prescription (non-blocking)
        createNotification({
          recipient: appointment.patient._id,
          sender: req.user._id,
          type: "prescription_added",
          title: "Prescription Added",
          message: `Dr. ${appointment.doctor.user.name} has added a prescription to your appointment`,
          relatedAppointment: appointment._id,
        }).catch(err => console.error("Prescription notification failed:", err));
      }
    }

    await appointment.save();

    res.json(appointment);
  } catch (error) {
    console.error("DEBUG - Update Appointment Status Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete appointment (only if pending and by the patient who created it)
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // Only the patient who created it can delete
    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Can only delete if still pending
    if (appointment.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Can only delete pending appointments" });
    }

    await appointment.deleteOne();

    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reschedule appointment (Patient or Doctor can reschedule)
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { newAppointmentDate, newAppointmentTime } = req.body;

    // Validate new date and time are provided
    if (!newAppointmentDate || !newAppointmentTime) {
      return res.status(400).json({ message: "New date and time are required" });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    if (!appointment)
      return res.status(404).json({ message: "Appointment not found" });

    // Authorization check
    const doctorProfile = await Doctor.findOne({ user: req.user._id });
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = doctorProfile && appointment.doctor._id.toString() === doctorProfile._id.toString();

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ message: "Not authorized to reschedule this appointment" });
    }

    // Can only reschedule pending or confirmed appointments
    if (!["pending", "confirmed"].includes(appointment.status)) {
      return res.status(400).json({ message: "Can only reschedule pending or confirmed appointments" });
    }

    // Store old details for notification
    const oldDate = new Date(appointment.appointmentDate).toLocaleDateString();
    const oldTime = appointment.appointmentTime;

    // Update appointment with new date and time
    appointment.appointmentDate = newAppointmentDate;
    appointment.appointmentTime = newAppointmentTime;
    await appointment.save();

    // Send notifications to both parties (non-blocking)
    const recipientEmail = isPatient ? appointment.doctor.user.email : appointment.patient.email;
    const requesterName = isPatient ? appointment.patient.name : appointment.doctor.user.name;

    sendAppointmentConfirmation(recipientEmail, {
      doctorName: appointment.doctor.user.name,
      date: new Date(newAppointmentDate).toLocaleDateString(),
      time: newAppointmentTime,
      consultationType: appointment.consultationType,
    }).catch(err => console.error("Reschedule email failed:", err));

    // Create in-app notification (non-blocking)
    const recipientId = isPatient ? appointment.doctor.user._id : appointment.patient._id;
    createNotification({
      recipient: recipientId,
      sender: req.user._id,
      type: "appointment_rescheduled",
      title: "Appointment Rescheduled",
      message: `${requesterName} has rescheduled your appointment from ${oldDate} at ${oldTime} to ${new Date(
        newAppointmentDate
      ).toLocaleDateString()} at ${newAppointmentTime}`,
      relatedAppointment: appointment._id,
    }).catch(err => console.error("Reschedule notification failed:", err));

    res.json({
      message: "Appointment rescheduled successfully",
      appointment,
    });
  } catch (error) {
    console.error("DEBUG - Reschedule Appointment Error:", error);
    res.status(500).json({ message: error.message });
  }
};