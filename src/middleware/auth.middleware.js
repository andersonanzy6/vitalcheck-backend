const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    console.error("Auth Error: No token provided");
    return res.status(401).json({ message: "Not authorized - No token provided" });
  }

  try {
    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET environment variable is not set");
      return res.status(500).json({ message: "Server configuration error - JWT_SECRET not set" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      console.error("Auth Error: User not found for token", { userId: decoded.id });
      return res.status(401).json({ message: "User not found" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: "Token invalid or expired" });
    }
    
    res.status(401).json({ message: "Authentication failed", error: error.message });
  }
};
