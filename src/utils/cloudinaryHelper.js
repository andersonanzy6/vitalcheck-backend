/**
 * Cloudinary File Management Utilities
 * Handles file uploads, deletions, and transformations
 */

const { cloudinary } = require("../config/cloudinary");

/**
 * Delete file from Cloudinary by public ID
 * @param {string} publicId - Cloudinary public_id of the file
 * @returns {Promise} Deletion result
 */
exports.deleteCloudinaryFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("File deleted from Cloudinary:", result);
    return result;
  } catch (error) {
    console.error("Error deleting file from Cloudinary:", error);
    throw error;
  }
};

/**
 * Get optimized image URL with transformations
 * @param {string} publicId - Cloudinary public_id
 * @param {object} options - Transformation options
 * @returns {string} Transformed image URL
 */
exports.getOptimizedImageUrl = (publicId, options = {}) => {
  const defaultOptions = {
    width: 300,
    height: 300,
    crop: "fill",
    quality: "auto",
    fetch_format: "auto",
  };

  const finalOptions = { ...defaultOptions, ...options };

  return cloudinary.url(publicId, finalOptions);
};

/**
 * Get thumbnail URL for profile images
 * @param {string} publicId - Cloudinary public_id
 * @returns {string} Thumbnail image URL
 */
exports.getThumbnailUrl = (publicId) => {
  return cloudinary.url(publicId, {
    width: 150,
    height: 150,
    crop: "fill",
    quality: "auto",
    fetch_format: "auto",
  });
};

/**
 * Get optimized URL for medical documents
 * @param {string} publicId - Cloudinary public_id
 * @returns {string} Document URL
 */
exports.getDocumentUrl = (publicId) => {
  return cloudinary.url(publicId, {
    quality: "auto",
    fetch_format: "auto",
  });
};

/**
 * Upload file to Cloudinary with custom folder
 * Note: This is a backend utility. Multer handles actual upload via middleware
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @returns {Promise} Upload result
 */
exports.uploadFileToCloudinary = async (filePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder || "uploads",
      resource_type: "auto",
    });
    return result;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
};

/**
 * Get file info from Cloudinary
 * @param {string} publicId - Cloudinary public_id
 * @returns {Promise} File information
 */
exports.getFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    return result;
  } catch (error) {
    console.error("Error getting file info:", error);
    throw error;
  }
};

/**
 * Validate file size (before upload)
 * @param {number} fileSizeInBytes - File size in bytes
 * @param {number} maxSizeInMB - Maximum allowed size in MB
 * @returns {boolean} True if valid
 */
exports.validateFileSize = (fileSizeInBytes, maxSizeInMB = 10) => {
  const maxBytesAllowed = maxSizeInMB * 1024 * 1024;
  return fileSizeInBytes <= maxBytesAllowed;
};

/**
 * Validate file type (MIME type)
 * @param {string} mimeType - File MIME type
 * @param {array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} True if valid
 */
exports.validateFileType = (
  mimeType,
  allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]
) => {
  return allowedTypes.includes(mimeType);
};

/**
 * Valid image MIME types
 */
exports.ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Valid document MIME types for medical records
 */
exports.ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

/**
 * Maximum file sizes
 */
exports.MAX_FILE_SIZES = {
  image: 5, // MB
  document: 25, // MB
  medical_record: 25, // MB
  profile_image: 5, // MB
};

module.exports = this;
