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