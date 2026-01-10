const Message = require("../models/Message");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message, appointmentId, messageType, fileUrl } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({ message: "Receiver and message are required" });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const newMessage = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      appointment: appointmentId || null,
      message,
      messageType: messageType || "text",
      fileUrl: fileUrl || null,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "name email role")
      .populate("receiver", "name email role");

    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get conversation between two users
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id },
      ],
    })
      .populate("sender", "name email role")
      .populate("receiver", "name email role")
      .sort({ createdAt: 1 }); // oldest first

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all conversations for logged-in user
exports.getAllConversations = async (req, res) => {
  try {
    // Find all unique users the current user has chatted with
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }],
    })
      .populate("sender", "name email role")
      .populate("receiver", "name email role")
      .sort({ createdAt: -1 });

    // Get unique conversation partners with last message
    const conversationMap = new Map();

    messages.forEach((msg) => {
      const partnerId =
        msg.sender._id.toString() === req.user._id.toString()
          ? msg.receiver._id.toString()
          : msg.sender._id.toString();

      if (!conversationMap.has(partnerId)) {
        const partner =
          msg.sender._id.toString() === req.user._id.toString()
            ? msg.receiver
            : msg.sender;

        conversationMap.set(partnerId, {
          partner,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
    });

    // Count unread messages for each conversation
    for (let [partnerId, conversation] of conversationMap) {
      const unreadCount = await Message.countDocuments({
        sender: partnerId,
        receiver: req.user._id,
        isRead: false,
      });
      conversation.unreadCount = unreadCount;
    }

    const conversations = Array.from(conversationMap.values());

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;

    await Message.updateMany(
      {
        sender: senderId,
        receiver: req.user._id,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only sender can delete their own message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await message.deleteOne();

    res.json({ message: "Message deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false,
    });

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};