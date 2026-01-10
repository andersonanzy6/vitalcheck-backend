const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getAllConversations,
  markMessagesAsRead,
  deleteMessage,
  getUnreadCount,
} = require("../controllers/chat.controller");
const auth = require("../middleware/auth.middleware");

// All chat routes are protected
router.post("/send", auth, sendMessage);
router.get("/conversations", auth, getAllConversations);
router.get("/conversation/:userId", auth, getConversation);
router.patch("/read/:senderId", auth, markMessagesAsRead);
router.delete("/:id", auth, deleteMessage);
router.get("/unread-count", auth, getUnreadCount);

module.exports = router;