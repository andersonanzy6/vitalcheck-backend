const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const CallSession = require("../models/CallSession");
const authenticate = require("../middleware/auth.middleware");

// GET /api/call/ice-servers
// STUN urls plus short-lived TURN credentials (coturn static-auth HMAC scheme,
// also what Cloudflare Calls TURN and Metered shared-secret setups expect).
// The permanent secret never leaves the server.
router.get("/ice-servers", authenticate, (req, res) => {
  const turnUrls = (process.env.TURN_URLS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  const iceServers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ];

  // Two supported setups:
  // 1) Fixed credential pair (e.g. Metered dashboard credential):
  //    TURN_USERNAME + TURN_PASSWORD
  // 2) Minted short-lived HMAC credentials (coturn static-auth /
  //    Cloudflare Calls TURN): TURN_SHARED_SECRET
  const turnUser = process.env.TURN_USERNAME;
  const turnPass = process.env.TURN_PASSWORD;
  const sharedSecret = process.env.TURN_SHARED_SECRET;

  if (turnUrls.length > 0 && turnUser && turnPass) {
    iceServers.push({ urls: turnUrls, username: turnUser, credential: turnPass });
  } else if (turnUrls.length > 0 && sharedSecret) {
    const ttl = parseInt(process.env.TURN_TTL_SECONDS || "3600", 10);
    const username = String(Math.floor(Date.now() / 1000) + ttl);
    const credential = crypto
      .createHmac("sha1", sharedSecret)
      .update(username)
      .digest("base64");
    iceServers.push({ urls: turnUrls, username, credential });
  }

  res.json({
    success: true,
    data: { iceServers, ttl: parseInt(process.env.TURN_TTL_SECONDS || "3600", 10) }
  });
});

// GET /api/call/history - recent call sessions involving the current user
router.get("/history", authenticate, async (req, res) => {
  try {
    const sessions = await CallSession.find({
      $or: [{ caller: req.user.id }, { receiver: req.user.id }]
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("caller", "name role")
      .populate("receiver", "name role");

    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load call history" });
  }
});

module.exports = router;
