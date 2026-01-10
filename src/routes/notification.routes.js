const express = require("express");
const router = express.Router();
const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require("../controllers/notification.controller");
const auth = require("../middleware/auth.middleware");

// All notification routes are protected
router.get("/", auth, getUserNotifications);
router.get("/unread-count", auth, getUnreadCount);
router.patch("/:id/read", auth, markAsRead);
router.patch("/mark-all-read", auth, markAllAsRead);
router.delete("/:id", auth, deleteNotification);

module.exports = router;