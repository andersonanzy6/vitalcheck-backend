const nodemailer = require("nodemailer");

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send appointment confirmation email
exports.sendAppointmentConfirmation = async (userEmail, appointmentDetails) => {
  const { doctorName, date, time, consultationType } = appointmentDetails;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "Appointment Confirmation - Health Consult App",
    html: `
      <h2>Your Appointment is Confirmed!</h2>
      <p>Dear Patient,</p>
      <p>Your appointment has been confirmed with the following details:</p>
      <ul>
        <li><strong>Doctor:</strong> ${doctorName}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Time:</strong> ${time}</li>
        <li><strong>Type:</strong> ${consultationType}</li>
      </ul>
      <p>Please be available at the scheduled time.</p>
      <p>Best regards,<br>Health Consult Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email error:", error);
  }
};

// Send appointment booking notification to doctor
exports.sendDoctorNotification = async (doctorEmail, appointmentDetails) => {
  const { patientName, date, time, consultationType, reason } = appointmentDetails;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: doctorEmail,
    subject: "New Appointment Booking - Health Consult App",
    html: `
      <h2>New Appointment Request</h2>
      <p>Dear Doctor,</p>
      <p>You have a new appointment request:</p>
      <ul>
        <li><strong>Patient:</strong> ${patientName}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Time:</strong> ${time}</li>
        <li><strong>Type:</strong> ${consultationType}</li>
        <li><strong>Reason:</strong> ${reason}</li>
      </ul>
      <p>Please log in to confirm the appointment.</p>
      <p>Best regards,<br>Health Consult Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Doctor notification sent");
  } catch (error) {
    console.error("Email error:", error);
  }
};

// Send appointment cancellation email
exports.sendCancellationEmail = async (userEmail, appointmentDetails) => {
  const { doctorName, date, time, cancelledBy, reason } = appointmentDetails;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "Appointment Cancelled - Health Consult App",
    html: `
      <h2>Appointment Cancelled</h2>
      <p>Dear User,</p>
      <p>Your appointment has been cancelled:</p>
      <ul>
        <li><strong>Doctor:</strong> ${doctorName}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Time:</strong> ${time}</li>
        <li><strong>Cancelled by:</strong> ${cancelledBy}</li>
        <li><strong>Reason:</strong> ${reason || "Not specified"}</li>
      </ul>
      <p>If you have any questions, please contact us.</p>
      <p>Best regards,<br>Health Consult Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Cancellation email sent");
  } catch (error) {
    console.error("Email error:", error);
  }
};

// Send appointment reminder (24 hours before)
exports.sendAppointmentReminder = async (userEmail, appointmentDetails) => {
  const { doctorName, date, time, consultationType } = appointmentDetails;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "Appointment Reminder - Tomorrow",
    html: `
      <h2>Appointment Reminder</h2>
      <p>Dear Patient,</p>
      <p>This is a reminder about your upcoming appointment:</p>
      <ul>
        <li><strong>Doctor:</strong> ${doctorName}</li>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Time:</strong> ${time}</li>
        <li><strong>Type:</strong> ${consultationType}</li>
      </ul>
      <p>Please be ready at the scheduled time.</p>
      <p>Best regards,<br>Health Consult Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Reminder email sent");
  } catch (error) {
    console.error("Email error:", error);
  }
};