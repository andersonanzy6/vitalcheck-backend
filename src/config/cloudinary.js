const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");


// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "medical-records", // folder name in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "pdf"], // allowed file types
    resource_type: "auto", // automatically detect file type
  },
});

const upload = multer({ storage });

module.exports = { cloudinary, upload };