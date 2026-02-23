/**
 * Email Templates for Health Consultation App
 * Provides HTML email templates for notifications
 */

const emailTemplates = {
  // Appointment confirmation template
  appointmentConfirmation: (details) => {
    const { doctorName, patientName, date, time, consultationType } = details;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bff; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
            .button { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>✓ Appointment Confirmed!</h2>
            </div>
            <div class="content">
              <p>Hi ${patientName || 'There'},</p>
              <p>Your appointment has been successfully confirmed. Here are the details:</p>
              
              <div class="details">
                <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Time:</strong> ${time}</p>
                <p><strong>Type:</strong> ${consultationType.charAt(0).toUpperCase() + consultationType.slice(1)} Consultation</p>
              </div>
              
              <p>Please be available a few minutes before the scheduled time. If you need to reschedule or have any questions, please contact us immediately.</p>
              
              <a href="https://vitalcheck-app.com/appointments" class="button">View Appointment Details</a>
              
              <div class="footer">
                <p>© 2026 Health Consultation App - All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  },

  // Doctor notification template
  doctorNotification: (details) => {
    const { patientName, date, time, consultationType, reason, patientAge, patientGender } = details;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #28a745; }
            .button { background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📋 New Appointment Request</h2>
            </div>
            <div class="content">
              <p>Hi Doctor,</p>
              <p>You have received a new appointment request. Please review the details below:</p>
              
              <div class="details">
                <p><strong>Patient Name:</strong> ${patientName}</p>
                <p><strong>Age:</strong> ${patientAge || 'Not specified'}</p>
                <p><strong>Gender:</strong> ${patientGender || 'Not specified'}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p><strong>Time:</strong> ${time}</p>
                <p><strong>Consultation Type:</strong> ${consultationType.charAt(0).toUpperCase() + consultationType.slice(1)}</p>
                <p><strong>Reason for Visit:</strong> ${reason || 'Not specified'}</p>
              </div>
              
              <p>Please log in to your dashboard to confirm or decline this appointment.</p>
              
              <a href="https://vitalcheck-app.com/doctor/appointments" class="button">Review Appointment</a>
              
              <div class="footer">
                <p>© 2026 Health Consultation App - All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  },

  // Cancellation notification
  appointmentCancellation: (details) => {
    const { doctorName, patientName, date, time, cancelledBy, reason } = details;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc3545; }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>✗ Appointment Cancelled</h2>
            </div>
            <div class="content">
              <p>Hi ${patientName || 'There'},</p>
              <p>Your appointment has been cancelled. Please see the details below:</p>
              
              <div class="details">
                <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
                <p><strong>Original Date:</strong> ${date}</p>
                <p><strong>Original Time:</strong> ${time}</p>
                <p><strong>Cancelled By:</strong> ${cancelledBy === 'patient' ? 'You' : 'Doctor'}</p>
                <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
              </div>
              
              <p>If you'd like to book another appointment, please visit our app.</p>
              
              <div class="footer">
                <p>© 2026 Health Consultation App - All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  },

  // Appointment rescheduled notification
  appointmentRescheduled: (details) => {
    const { doctorName, patientName, oldDate, oldTime, newDate, newTime } = details;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ffc107; color: #333; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; }
            .comparison { display: flex; justify-content: space-between; padding: 10px 0; }
            .old { color: #999; text-decoration: line-through; }
            .new { color: #28a745; font-weight: bold; }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📅 Appointment Rescheduled</h2>
            </div>
            <div class="content">
              <p>Hi ${patientName || 'There'},</p>
              <p>Your appointment has been rescheduled. Here are the updated details:</p>
              
              <div class="details">
                <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
                <div class="comparison">
                  <div>
                    <p class="old">${oldDate} at ${oldTime}</p>
                  </div>
                  <div>→</div>
                  <div>
                    <p class="new">${newDate} at ${newTime}</p>
                  </div>
                </div>
              </div>
              
              <p>Please update your calendar with the new date and time. If you need further changes, contact us immediately.</p>
              
              <div class="footer">
                <p>© 2026 Health Consultation App - All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  },

  // Prescription notification
  prescriptionAdded: (details) => {
    const { patientName, doctorName, prescriptionDetails } = details;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #17a2b8; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #17a2b8; }
            .button { background-color: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>💊 Prescription Added</h2>
            </div>
            <div class="content">
              <p>Hi ${patientName},</p>
              <p>Dr. ${doctorName} has added a prescription to your appointment. You can view it below:</p>
              
              <div class="details">
                ${prescriptionDetails || '<p>View prescription in your app for detailed medication information.</p>'}
              </div>
              
              <p>Please follow the prescription as directed. If you have questions, consult your doctor.</p>
              
              <a href="https://vitalcheck-app.com/prescriptions" class="button">View Prescription</a>
              
              <div class="footer">
                <p>© 2026 Health Consultation App - All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  },

  // Payment receipt
  paymentReceipt: (details) => {
    const { patientName, appointmentId, amount, paymentMethod, transactionId, date } = details;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #20c997; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
            .receipt { background-color: white; padding: 20px; margin: 15px 0; border: 2px solid #20c997; border-radius: 5px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .label { font-weight: bold; }
            .amount { color: #20c997; font-weight: bold; font-size: 18px; }
            .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>✓ Payment Receipt</h2>
            </div>
            <div class="content">
              <p>Hi ${patientName},</p>
              <p>Thank you for your payment. Here is your receipt:</p>
              
              <div class="receipt">
                <div class="row">
                  <span class="label">Appointment ID:</span>
                  <span>${appointmentId}</span>
                </div>
                <div class="row">
                  <span class="label">Transaction ID:</span>
                  <span>${transactionId}</span>
                </div>
                <div class="row">
                  <span class="label">Payment Method:</span>
                  <span>${paymentMethod}</span>
                </div>
                <div class="row">
                  <span class="label">Date:</span>
                  <span>${date}</span>
                </div>
                <div class="row" style="border: none; margin-top: 10px;">
                  <span class="label">Amount Paid:</span>
                  <span class="amount">$${amount}</span>
                </div>
              </div>
              
              <p>Your payment has been processed successfully. You're all set for your appointment!</p>
              
              <div class="footer">
                <p>© 2026 Health Consultation App - All rights reserved</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  },
};

module.exports = emailTemplates;
