const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// 🔐 Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// 📦 Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "quiz-questions",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

// 🚀 Middleware
const uploadQuestionImage = multer({ storage });

module.exports = uploadQuestionImage;
