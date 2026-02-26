const express = require("express");
const router = express.Router();
const { register, login, updateProfile, getProfile } = require("../controllers/auth.controller");
const auth = require("../middleware/auth.middleware");

const { upload } = require("../config/cloudinary");

router.post("/register", upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'licenseUpload', maxCount: 1 }
]), register);
router.post("/login", login);
router.get("/profile", auth, getProfile);
router.put("/profile", auth, upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 }
]), updateProfile);

module.exports = router;
