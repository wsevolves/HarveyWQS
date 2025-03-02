const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save files in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    const uniqueFilename = uuidv4() + path.extname(file.originalname); // Generate a unique filename
    cb(null, uniqueFilename);
  },
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;