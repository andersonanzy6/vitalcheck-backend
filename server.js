require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./src/models/Message");
const User = require("./src/models/User");
const Doctor = require("./src/models/Doctor");

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://vitalcheck-56uj.onrender.com",
      "https://vitalcheck-web.onrender.com",
      "https://app.vitalcheck.com.ng",
      "https://admin.vitalcheck.com.ng"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Store active users with their role info
const activeUsers = new Map(); // userId -> { socketId, role, isOnline }
// Store pending consultation requests: queueId -> { patientId, doctorId, specialization, timer }
const pendingConsultations = new Map();

// Helper to find available doctor by specialization
const findAvailableDoctor = async (specialization, excludeDoctorId) => {
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
    console.error('[Socket Auth] No token provided');
    return next(new Error("Authentication error: No token"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id || decoded._id;
    console.log('[Socket Auth] ✅ Token verified for user:', socket.userId);
    next();
  } catch (error) {
    console.error('[Socket Auth] ❌ Token verification failed:', error.message);
    next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.io connection
io.on("connection", async (socket) => {
  console.log(`User connected: ${socket.userId}`);

  try {
    // Fetch user role from database
    const user = await User.findById(socket.userId);
    const userRole = user?.role || "unknown";
    
    // Add user to active users
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      role: userRole,
      isOnline: true,
    });

    // If doctor goes online, notify all patients in chat conversations
    if (userRole === "doctor") {
      console.log(`Doctor ${socket.userId} is now ONLINE`);
      io.emit("user_online", {
        userId: socket.userId,
        role: "doctor",
        timestamp: new Date(),
      });

      // Update doctor's online status in database
      await Doctor.findOneAndUpdate(
        { user: socket.userId },
        { isOnline: true, lastSeen: new Date() }
      );
    }

    // Emit active users to all clients
    io.emit("active-users", Array.from(activeUsers.keys()));
  } catch (error) {
    console.error("Error on user connection:", error);
  }

  // Listen for new messages
  socket.on("send-message", async (data) => {
    try {
      const { receiverId, message, appointmentId, messageType, fileUrl } = data;

      console.log(`[Message] From ${socket.userId} to ${receiverId}: ${message.substring(0, 50)}...`);

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
      const receiverData = activeUsers.get(receiverId);
      const receiverSocketId = receiverData?.socketId;
      
      if (receiverSocketId) {
        console.log(`[Message] Delivering to receiver socket: ${receiverSocketId}`);
        io.to(receiverSocketId).emit("message-received", populatedMessage);
      } else {
        console.log(`[Message] Receiver ${receiverId} not online. Active users: ${Array.from(activeUsers.keys()).join(', ')}`);
      }

      // Send confirmation back to sender
      socket.emit("message-sent", populatedMessage);
    } catch (error) {
      console.error("[Message Error]", error);
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

      const doctorData = activeUsers.get(doctorId);
      const doctorSocketId = doctorData?.socketId;

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
            const doctorData = activeUsers.get(doctorId);
            if (doctorData?.socketId) {
              io.to(doctorData.socketId).emit("request-timeout", { queueId });
            }

            // Reassign logic
            const newDoctor = await findAvailableDoctor(specialization, doctorId);
            if (newDoctor) {
              pending.doctorId = newDoctor.user._id.toString();
              pendingConsultations.set(queueId, pending);

              const newDoctorData = activeUsers.get(pending.doctorId);
              const newDoctorSocketId = newDoctorData?.socketId;
              if (newDoctorSocketId) {
                io.to(newDoctorSocketId).emit("consultation-request", {
                  queueId,
                  patientId,
                  timeout: 120000,
                });
              } else {
                // Should not happen if findAvailableDoctor checks isOnline
                const patientData = activeUsers.get(patientId);
                if (patientData?.socketId) {
                  io.to(patientData.socketId).emit("consultation-failed", {
                    message: "No doctors available at the moment."
                  });
                }
                pendingConsultations.delete(queueId);
              }
            } else {
              const patientData = activeUsers.get(patientId);
              if (patientData?.socketId) {
                io.to(patientData.socketId).emit("consultation-failed", {
                  message: "No other doctors available for your specialization."
                });
              }
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
      const patientData = activeUsers.get(pending.patientId);
      const patientSocketId = patientData?.socketId;
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

        // Start new timer for the new doctor
        pending.timer = setTimeout(async () => {
          const stillPending = pendingConsultations.get(queueId);
          if (stillPending) {
            const patientData = activeUsers.get(stillPending.patientId);
            const patientSocketId = patientData?.socketId;
            if (patientSocketId) {
              io.to(patientSocketId).emit("consultation-failed", {
                message: "No doctors are currently available. Please try again later."
              });
            }
            pendingConsultations.delete(queueId);
          }
        }, 120000);

        const newDoctorData = activeUsers.get(pending.doctorId);
        const newDoctorSocketId = newDoctorData?.socketId;
        if (newDoctorSocketId) {
          io.to(newDoctorSocketId).emit("consultation-request", {
            queueId,
            patientId: pending.patientId,
            timeout: 120000
          });
        }
      } else {
        const patientData = activeUsers.get(pending.patientId);
        const patientSocketId = patientData?.socketId;
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
    console.log(`[Call] ${socket.userId} initiating ${callType} call to ${targetUserId}`);
    const targetData = activeUsers.get(targetUserId);
    const targetSocketId = targetData?.socketId;
    
    if (targetSocketId) {
      console.log(`[Call] Sending incoming-call to socket ${targetSocketId}`);
      io.to(targetSocketId).emit("incoming-call", {
        from: socket.userId,
        callerName,
        roomId,
        callType,
      });
    } else {
      console.log(`[Call] Target user ${targetUserId} not online. Active users: ${Array.from(activeUsers.keys()).join(', ')}`);
      socket.emit("call-failed", {
        message: `User ${targetUserId} is not online`
      });
    }
  });

  // User accepts the incoming call
  socket.on("call-accepted", ({ targetUserId, roomId }) => {
    console.log(`[Call] ${socket.userId} accepted call from ${targetUserId}`);
    const targetData = activeUsers.get(targetUserId);
    const targetSocketId = targetData?.socketId;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-accepted", { roomId });
    }
  });

  // User declines the incoming call
  socket.on("call-declined", ({ targetUserId }) => {
    console.log(`[Call] ${socket.userId} declined call from ${targetUserId}`);
    const targetData = activeUsers.get(targetUserId);
    const targetSocketId = targetData?.socketId;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-declined");
    }
  });

  // User ends the call
  socket.on("call-ended", ({ targetUserId }) => {
    console.log(`[Call] ${socket.userId} ended call with ${targetUserId}`);
    const targetData = activeUsers.get(targetUserId);
    const targetSocketId = targetData?.socketId;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended");
    }
  });

  // Notify caller that call was missed
  socket.on("call-missed", ({ targetUserId }) => {
    console.log(`[Call] ${socket.userId} call to ${targetUserId} was missed`);
    const targetData = activeUsers.get(targetUserId);
    const targetSocketId = targetData?.socketId;
    
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-missed");
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    console.log(`User disconnected: ${socket.userId}`);
    
    const userData = activeUsers.get(socket.userId);
    
    // If doctor goes offline, notify all patients
    if (userData?.role === "doctor") {
      console.log(`Doctor ${socket.userId} is now OFFLINE`);
      
      const lastSeenTime = new Date();
      
      // Update doctor's online status in database
      await Doctor.findOneAndUpdate(
        { user: socket.userId },
        { isOnline: false, lastSeen: lastSeenTime }
      );
      
      io.emit("user_offline", {
        userId: socket.userId,
        role: "doctor",
        lastSeen: lastSeenTime,
      });
    }
    
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