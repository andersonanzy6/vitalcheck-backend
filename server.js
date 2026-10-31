require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Message = require("./src/models/Message");
const User = require("./src/models/User");
const Doctor = require("./src/models/Doctor");
const CallSession = require("./src/models/CallSession");

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

// Store active users with their role info.
// socketIds is a Set so a user with several tabs/devices stays reachable.
const activeUsers = new Map(); // userId -> { socketIds: Set, role, isOnline }

const getSocketIds = (userId) => Array.from(activeUsers.get(userId)?.socketIds || []);

// Emit to every socket a user has open
const emitToUser = (userId, event, payload) => {
  for (const sid of getSocketIds(userId)) io.to(sid).emit(event, payload);
};
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
    
    // Add user to active users (multi-socket safe)
    const existing = activeUsers.get(socket.userId);
    if (existing) {
      existing.socketIds.add(socket.id);
      existing.isOnline = true;
    } else {
      activeUsers.set(socket.userId, {
        socketIds: new Set([socket.id]),
        role: userRole,
        isOnline: true,
      });
    }

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

      // Deliver to every socket the receiver has open
      const receiverSockets = getSocketIds(receiverId);
      if (receiverSockets.length > 0) {
        for (const sid of receiverSockets) {
          io.to(sid).emit("message-received", populatedMessage);
        }
        // delivery receipt back to the sender's devices
        emitToUser(socket.userId, "message-delivered", {
          messageIds: [populatedMessage._id],
          deliveredTo: receiverId,
        });
      } else {
        console.log(`[Message] Receiver ${receiverId} not online`);
      }

      // live conversation-list bump for both parties
      emitToUser(receiverId, "conversation-updated", {
        partnerId: socket.userId,
        lastMessage: {
          _id: populatedMessage._id,
          message: populatedMessage.message,
          sender: populatedMessage.sender,
          createdAt: populatedMessage.createdAt,
        },
      });
      emitToUser(socket.userId, "conversation-updated", {
        partnerId: receiverId,
        lastMessage: {
          _id: populatedMessage._id,
          message: populatedMessage.message,
          sender: populatedMessage.sender,
          createdAt: populatedMessage.createdAt,
        },
      });

      // confirmation back to sender
      socket.emit("message-sent", populatedMessage);
    } catch (error) {
      console.error("[Message Error]", error);
      socket.emit("message-error", { message: error.message });
    }
  });

  // Listen for typing indicator
  socket.on("typing", (data) => {
    const { receiverId } = data;
    emitToUser(receiverId, "user-typing", { userId: socket.userId });
  });

  // Listen for stop typing
  socket.on("stop-typing", (data) => {
    const { receiverId } = data;
    emitToUser(receiverId, "user-stop-typing", { userId: socket.userId });
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

      // Notify sender that messages were read (with which ids)
      const readDocs = await Message.find({
        sender: senderId,
        receiver: socket.userId,
        isRead: true,
      }).select("_id");
      emitToUser(senderId, "messages-read", {
        readBy: socket.userId,
        messageIds: readDocs.map((d) => d._id),
      });
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

      const doctorOnline = getSocketIds(doctorId).length > 0;

      if (doctorOnline) {
        // Notify doctor
        emitToUser(doctorId, "consultation-request", {
          queueId,
          patientId,
          timeout: 120000, // 2 minutes in ms
        });

        // Set timeout for 2 minutes
        const timer = setTimeout(async () => {
          const pending = pendingConsultations.get(queueId);
          if (pending) {
            console.log(`Consultation ${queueId} timed out. Reassigning...`);
            emitToUser(doctorId, "request-timeout", { queueId });

            // Reassign logic
            const newDoctor = await findAvailableDoctor(specialization, doctorId);
            if (newDoctor) {
              pending.doctorId = newDoctor.user._id.toString();
              pendingConsultations.set(queueId, pending);

              if (getSocketIds(pending.doctorId).length > 0) {
                emitToUser(pending.doctorId, "consultation-request", {
                  queueId,
                  patientId,
                  timeout: 120000,
                });
              } else {
                emitToUser(patientId, "consultation-failed", {
                  message: "No doctors available at the moment."
                });
                pendingConsultations.delete(queueId);
              }
            } else {
              emitToUser(patientId, "consultation-failed", {
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
      emitToUser(pending.patientId, "consultation-accepted", {
        doctorId: socket.userId,
        queueId
      });
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
            emitToUser(stillPending.patientId, "consultation-failed", {
              message: "No doctors are currently available. Please try again later."
            });
            pendingConsultations.delete(queueId);
          }
        }, 120000);

        if (getSocketIds(pending.doctorId).length > 0) {
          emitToUser(pending.doctorId, "consultation-request", {
            queueId,
            patientId: pending.patientId,
            timeout: 120000
          });
        }
      } else {
        emitToUser(patientId, "consultation-failed", {
          message: "No other doctors available."
        });
        pendingConsultations.delete(queueId);
      }
    }
  });

  // --- AUDIO/VIDEO CALL LOGIC (native WebRTC, Socket.IO signaling) ---
  // Media flows peer-to-peer between browsers (STUN/TURN for NAT traversal);
  // the server only relays signaling and keeps a CallSession record.

  // Caller rings the callee
  socket.on("call-user", ({ targetUserId, callType, callerName }) => {
    console.log(`[Call] ${socket.userId} initiating ${callType} call to ${targetUserId}`);
    const targetSockets = getSocketIds(targetUserId);

    if (targetSockets.length > 0) {
      for (const sid of targetSockets) {
        io.to(sid).emit("incoming-call", {
          from: socket.userId,
          callerName,
          callType,
        });
      }
    } else {
      console.log(`[Call] Target user ${targetUserId} not online`);
      socket.emit("call-failed", { message: "User is not online" });
    }
  });

  // Callee accepts: both sides now exchange WebRTC SDP + ICE
  socket.on("call-accepted", async ({ targetUserId, callType }) => {
    console.log(`[Call] ${socket.userId} accepted call from ${targetUserId}`);
    emitToUser(targetUserId, "call-accepted", { from: socket.userId });

    try {
      await CallSession.create({
        caller: targetUserId,
        receiver: socket.userId,
        type: callType === "video" ? "video" : "audio",
        status: "started",
        startTime: new Date(),
      });
    } catch (err) {
      console.error("[Call] Failed to persist CallSession:", err.message);
    }
  });

  // Callee declines
  socket.on("call-declined", ({ targetUserId }) => {
    emitToUser(targetUserId, "call-declined");
  });

  // Caller cancels while ringing
  socket.on("call-cancelled", ({ targetUserId }) => {
    emitToUser(targetUserId, "call-cancelled");
  });

  // Either side ends an established call
  socket.on("call-ended", ({ targetUserId }) => {
    emitToUser(targetUserId, "call-ended");
  });

  // WebRTC SDP offer
  socket.on("webrtc-offer", ({ targetUserId, description }) => {
    emitToUser(targetUserId, "webrtc-offer", {
      from: socket.userId,
      description,
    });
  });

  // WebRTC SDP answer
  socket.on("webrtc-answer", ({ targetUserId, description }) => {
    emitToUser(targetUserId, "webrtc-answer", {
      from: socket.userId,
      description,
    });
  });

  // WebRTC ICE candidates (trickled)
  socket.on("webrtc-ice-candidate", ({ targetUserId, candidate }) => {
    emitToUser(targetUserId, "webrtc-ice-candidate", {
      from: socket.userId,
      candidate,
    });
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
    
    // Remove just this socket; the user is only offline when the last tab closes.
    const entry = activeUsers.get(socket.userId);
    if (entry) {
      entry.socketIds.delete(socket.id);
      if (entry.socketIds.size === 0) {
        activeUsers.delete(socket.userId);
        io.emit("active-users", Array.from(activeUsers.keys()));
      }
    }
  });
});

// Connect to database
connectDB();

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for connections`);
});