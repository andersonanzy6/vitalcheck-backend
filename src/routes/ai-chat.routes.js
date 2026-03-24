const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getConversation,
  getConversationHistory,
  closeConversation,
  deleteConversation,
  getDischargeSummary,
  symptomCheck,
} = require("../controllers/ai-chat.controller");
const auth = require("../middleware/auth.middleware");

// Public symptom checker route (no login required)
router.post("/symptom-check", symptomCheck);

// Protect all remaining routes with authentication
router.use(auth);

// Send a message to AI and get response
router.post("/send", sendMessage);

// Get a specific conversation
router.get("/:conversationId", getConversation);

// Get all conversations for the user
router.get("/", getConversationHistory);

// Close a conversation
router.put("/:conversationId/close", closeConversation);

// Delete a conversation
router.delete("/:conversationId", deleteConversation);

// Get a summary of the conversation
router.get("/:conversationId/summary", getDischargeSummary);

module.exports = router;
