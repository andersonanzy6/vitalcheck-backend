require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./src/models/Message");

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your frontend URL
    methods: ["GET", "POST"],
  },
});

// Store active users
const activeUsers = new Map();
// Store pending consultation requests: queueId -> { patientId, doctorId, specialization, timer }
const pendingConsultations = new Map();

// Helper to find available doctor by specialization
const findAvailableDoctor = async (specialization, excludeDoctorId) => {
  const Doctor = require("./src/models/Doctor");
  const availableDoctor = await Doctor.findOne({
    specialization,
    isOnline: true,
    verificationStatus: "approved",
    user: { $ne: excludeDoctorId }
  }).populate("user");
  return availableDoctor;
};

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Add user to active users
  activeUsers.set(socket.userId, socket.id);

  // Emit active users to all clients
  io.emit("active-users", Array.from(activeUsers.keys()));

  // Listen for new messages
  socket.on("send-message", async (data) => {
    try {
      const { receiverId, message, appointmentId, messageType, fileUrl } = data;

      // Save message to database
      const newMessage = await Message.create({
        sender: socket.userId,
        receiver: receiverId,
        appointment: appointmentId || null,
        message,
        messageType: messageType || "text",
        fileUrl: fileUrl || null,
      });

      const populatedMessage = await Message.findById(newMessage._id)
        .populate("sender", "name email role")
        .populate("receiver", "name email role");

      // Send to receiver if online
      const receiverSocketId = activeUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive-message", populatedMessage);
      }

      // Send confirmation back to sender
      socket.emit("message-sent", populatedMessage);
    } catch (error) {
      socket.emit("message-error", { message: error.message });
    }
  });

  // Listen for typing indicator
  socket.on("typing", (data) => {
    const { receiverId } = data;
    const receiverSocketId = activeUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user-typing", { userId: socket.userId });
    }
  });

  // Listen for stop typing
  socket.on("stop-typing", (data) => {
    const { receiverId } = data;
    const receiverSocketId = activeUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user-stop-typing", { userId: socket.userId });
    }
  });

  // Mark messages as read
  socket.on("mark-read", async (data) => {
    try {
      const { senderId } = data;
      await Message.updateMany(
        {
          sender: senderId,
          receiver: socket.userId,
          isRead: false,
        },
        {
          isRead: true,
          readAt: new Date(),
        }
      );

      // Notify sender that messages were read
      const senderSocketId = activeUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messages-read", { readBy: socket.userId });
      }
    } catch (error) {
      console.error("Mark read error:", error);
    }
  });

  // --- CONSULTATION REQUEST LOGIC ---

  // Patient requests a consultation
  socket.on("request-consultation", async (data) => {
    try {
      const { doctorId, specialization } = data;
      const patientId = socket.userId;
      const queueId = `q_${Date.now()}_${patientId}`;

      const doctorSocketId = activeUsers.get(doctorId);

      if (doctorSocketId) {
        // Notify doctor
        io.to(doctorSocketId).emit("consultation-request", {
          queueId,
          patientId,
          timeout: 120000, // 2 minutes in ms
        });

        // Set timeout for 2 minutes
        const timer = setTimeout(async () => {
          const pending = pendingConsultations.get(queueId);
          if (pending) {
            console.log(`Consultation ${queueId} timed out. Reassigning...`);
            // Notify doctor that request expired
            io.to(activeUsers.get(doctorId)).emit("request-timeout", { queueId });

            // Reassign logic
            const newDoctor = await findAvailableDoctor(specialization, doctorId);
            if (newDoctor) {
              pending.doctorId = newDoctor.user._id.toString();
              pendingConsultations.set(queueId, pending);

              const newDoctorSocketId = activeUsers.get(pending.doctorId);
              if (newDoctorSocketId) {
                io.to(newDoctorSocketId).emit("consultation-request", {
                  queueId,
                  patientId,
                  timeout: 120000,
                });
              } else {
                // Should not happen if findAvailableDoctor checks isOnline
                io.to(activeUsers.get(patientId)).emit("consultation-failed", {
                  message: "No doctors available at the moment."
                });
                pendingConsultations.delete(queueId);
              }
            } else {
              io.to(activeUsers.get(patientId)).emit("consultation-failed", {
                message: "No other doctors available for your specialization."
              });
              pendingConsultations.delete(queueId);
            }
          }
        }, 120000);

        pendingConsultations.set(queueId, { patientId, doctorId, specialization, timer });
      } else {
        socket.emit("consultation-failed", { message: "Doctor is currently offline." });
      }
    } catch (error) {
      socket.emit("consultation-error", { message: error.message });
    }
  });

  // Doctor accepts consultation
  socket.on("accept-consultation", (data) => {
    const { queueId } = data;
    const pending = pendingConsultations.get(queueId);

    if (pending) {
      clearTimeout(pending.timer);
      const patientSocketId = activeUsers.get(pending.patientId);
      if (patientSocketId) {
        io.to(patientSocketId).emit("consultation-accepted", {
          doctorId: socket.userId,
          queueId
        });
      }
      pendingConsultations.delete(queueId);
    }
  });

  // Doctor rejects consultation
  socket.on("reject-consultation", async (data) => {
    const { queueId } = data;
    const pending = pendingConsultations.get(queueId);

    if (pending) {
      clearTimeout(pending.timer);
      console.log(`Doctor rejected consultation ${queueId}. Reassigning...`);

      const newDoctor = await findAvailableDoctor(pending.specialization, socket.userId);
      if (newDoctor) {
        pending.doctorId = newDoctor.user._id.toString();
        pendingConsultations.set(queueId, pending);

        // Start new timer for the new doctor — notify patient if they also don't respond
        pending.timer = setTimeout(async () => {
          const stillPending = pendingConsultations.get(queueId);
          if (stillPending) {
            const patientSocketId = activeUsers.get(stillPending.patientId);
            if (patientSocketId) {
              io.to(patientSocketId).emit("consultation-failed", {
                message: "No doctors are currently available. Please try again later.",
              });
            }
            pendingConsultations.delete(queueId);
          }
        }, 120000);

        const newDoctorSocketId = activeUsers.get(pending.doctorId);
        if (newDoctorSocketId) {
          io.to(newDoctorSocketId).emit("consultation-request", {
            queueId,
            patientId: pending.patientId,
            timeout: 120000,
          });
        }
      } else {
        const patientSocketId = activeUsers.get(pending.patientId);
        if (patientSocketId) {
          io.to(patientSocketId).emit("consultation-failed", {
            message: "No other doctors available."
          });
        }
        pendingConsultations.delete(queueId);
      }
    }
  });

  // --- AUDIO/VIDEO CALL LOGIC (100ms) ---

  // Initiate a call to another user
  socket.on("call-user", ({ targetUserId, roomId, callType, callerName }) => {
    const targetSocketId = activeUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("incoming-call", {
        from: socket.userId,
        callerName,
        roomId,
        callType,
      });
    }
  });

  // User accepts the incoming call
  socket.on("call-accepted", ({ targetUserId, roomId }) => {
    const targetSocketId = activeUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-accepted", { roomId });
    }
  });

  // User declines the incoming call
  socket.on("call-declined", ({ targetUserId }) => {
    const targetSocketId = activeUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-declined");
    }
  });

  // User ends the call
  socket.on("call-ended", ({ targetUserId }) => {
    const targetSocketId = activeUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended");
    }
  });

  // Notify caller that call was missed
  socket.on("call-missed", ({ targetUserId }) => {
    const targetSocketId = activeUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-missed");
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.userId}`);
    activeUsers.delete(socket.userId);
    io.emit("active-users", Array.from(activeUsers.keys()));
  });
});

// Connect to database
connectDB();

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for connections`);
});