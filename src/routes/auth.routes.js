const express = require("express");
const router = express.Router();
const { register, login, updateProfile } = require("../controllers/auth.controller");
const auth = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.put("/profile", auth, updateProfile);

module.exports = router;
