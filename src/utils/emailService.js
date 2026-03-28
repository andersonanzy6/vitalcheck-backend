const { Resend } = require("resend");

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "VitalCheck <no-reply@send.vitalcheck.com.ng>";

// Send appointment confirmation email
exports.sendAppointmentConfirmation = async (userEmail, appointmentDetails) => {
  const { doctorName, date, time, consultationType } = appointmentDetails;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: "Appointment Confirmation - VitalCheck",
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
        <p>Best regards,<br>VitalCheck Team</p>
      `,
    });
    console.log("Appointment confirmation email sent to", userEmail);
  } catch (error) {
    console.error("Error sending appointment confirmation email:", error);
  }
};

// Send appointment booking notification to doctor
exports.sendDoctorNotification = async (doctorEmail, appointmentDetails) => {
  const { patientName, date, time, consultationType, reason } = appointmentDetails;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: doctorEmail,
      subject: "New Appointment Booking - VitalCheck",
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
        <p>Best regards,<br>VitalCheck Team</p>
      `,
    });
    console.log("Doctor notification email sent to", doctorEmail);
  } catch (error) {
    console.error("Error sending doctor notification:", error);
  }
};

// Send appointment cancellation email
exports.sendCancellationEmail = async (userEmail, appointmentDetails) => {
  const { doctorName, date, time, cancelledBy, reason } = appointmentDetails;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: "Appointment Cancelled - VitalCheck",
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
        <p>Best regards,<br>VitalCheck Team</p>
      `,
    });
    console.log("Cancellation email sent to", userEmail);
  } catch (error) {
    console.error("Error sending cancellation email:", error);
  }
};

// Send appointment reminder (24 hours before)
exports.sendAppointmentReminder = async (userEmail, appointmentDetails) => {
  const { doctorName, date, time, consultationType } = appointmentDetails;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
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
        <p>Best regards,<br>VitalCheck Team</p>
      `,
    });
    console.log("Reminder email sent to", userEmail);
  } catch (error) {
    console.error("Error sending reminder email:", error);
  }
};

// Send welcome email to new users
exports.sendWelcomeEmail = async (userEmail, userName) => {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: "Welcome to VitalCheck!",
      html: `
        <h2>Welcome to VitalCheck!</h2>
        <p>Hi ${userName},</p>
        <p>Thank you for registering with VitalCheck. We're excited to have you on board!</p>
        <p>You can now:</p>
        <ul>
          <li>Browse and book appointments with qualified doctors</li>
          <li>Manage your medical records securely</li>
          <li>Chat with your healthcare providers in real-time</li>
          <li>Get AI-powered health insights and recommendations</li>
        </ul>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>The VitalCheck Team</p>
      `,
    });
    console.log("Welcome email sent to", userEmail);
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
};

// Send payment confirmation email
exports.sendPaymentConfirmationEmail = async (userEmail, paymentDetails) => {
  const { transactionId, amount, status, paymentMethod, appointmentDate, doctorName } = paymentDetails;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `Payment ${status.toUpperCase()} - VitalCheck`,
      html: `
        <h2>Payment Confirmation</h2>
        <p>Dear Patient,</p>
        <p>Your payment has been ${status}:</p>
        <ul>
          <li><strong>Transaction ID:</strong> ${transactionId}</li>
          <li><strong>Amount:</strong> ₦${amount}</li>
          <li><strong>Status:</strong> ${status.toUpperCase()}</li>
          <li><strong>Payment Method:</strong> ${paymentMethod}</li>
          <li><strong>Doctor:</strong> ${doctorName}</li>
          <li><strong>Appointment Date:</strong> ${appointmentDate}</li>
        </ul>
        <p>Thank you for using VitalCheck.</p>
        <p>Best regards,<br>VitalCheck Team</p>
      `,
    });
    console.log("Payment confirmation email sent to", userEmail);
  } catch (error) {
    console.error("Error sending payment confirmation:", error);
  }
};

// Send password reset email
exports.sendPasswordResetEmail = async (userEmail, resetLink) => {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: "Password Reset Request - VitalCheck",
      html: `
        <h2>Password Reset</h2>
        <p>Dear User,</p>
        <p>We received a request to reset your password. Click the link below to reset it:</p>
        <p><a href="${resetLink}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>VitalCheck Team</p>
      `,
    });
    console.log("Password reset email sent to", userEmail);
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
};
