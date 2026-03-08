const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const doctorRoutes = require("./routes/doctor.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const medicalRecordRoutes = require("./routes/medicalRecord.routes");
const notificationRoutes = require("./routes/notification.routes");
const chatRoutes = require("./routes/chat.routes");
const aiChatRoutes = require("./routes/ai-chat.routes");
const adminRoutes = require("./routes/admin.routes");
const paymentRoutes = require("./routes/payment.routes");
const callRoutes = require("./routes/call");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/medical-records", medicalRecordRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/ai-chat", aiChatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/call", callRoutes);

app.get("/", (req, res) => {
  res.json({ status: "API running" });
});

module.exports = app;
