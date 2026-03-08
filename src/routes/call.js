const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const authenticate = require("../middleware/auth.middleware");

const HMS_ACCESS_KEY = process.env.HMS_ACCESS_KEY;
const HMS_SECRET = process.env.HMS_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Helper function to generate Management Token
 * Used for server-to-server API calls to 100ms
 */
function getManagementToken() {
  const payload = {
    access_key: HMS_ACCESS_KEY,
    type: "management",
    version: 2,
  };

  return jwt.sign(payload, HMS_SECRET, {
    algorithm: "HS256",
    expiresIn: "24h",
  });
}

/**
 * Helper function to generate Auth Token
 * Used for client-side JWT authentication in 100ms rooms
 */
function getAuthToken(roomId, userId, role = "guest") {
  const payload = {
    access_key: HMS_ACCESS_KEY,
    room_id: roomId,
    user_id: userId,
    role: role,
    type: "app",
    version: 2,
  };

  return jwt.sign(payload, HMS_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

/**
 * POST /api/call/create-room
 * Creates a new 100ms room and returns roomId and auth token
 */
router.post("/create-room", authenticate, async (req, res) => {
  try {
    const managementToken = getManagementToken();
    const roomName = `room-${uuidv4()}`;

    // Call 100ms API to create a room
    const response = await axios.post(
      "https://api.100ms.live/v2/rooms",
      {
        name: roomName,
        description: "vitalcheck consultation",
      },
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const roomId = response.data.id;
    const authToken = getAuthToken(roomId, req.user.id, "host");

    res.json({
      success: true,
      roomId,
      token: authToken,
      roomName,
    });
  } catch (error) {
    console.error("Error creating room:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create room",
      error: error.message,
    });
  }
});

/**
 * POST /api/call/join-room
 * Generates an auth token to join an existing 100ms room
 */
router.post("/join-room", authenticate, async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required",
      });
    }

    const authToken = getAuthToken(roomId, req.user.id, "guest");

    res.json({
      success: true,
      token: authToken,
      roomId,
    });
  } catch (error) {
    console.error("Error joining room:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to join room",
      error: error.message,
    });
  }
});

module.exports = router;
