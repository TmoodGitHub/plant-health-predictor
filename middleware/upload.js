const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Each analysis session gets its own folder
    if (!req.sessionId) {
      req.sessionId = uuidv4();
    }
    const sessionDir = path.join(
      UPLOADS_DIR,
      req.sessionId,
    );
    fs.mkdirSync(sessionDir, { recursive: true });
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    // Preserve upload order in filename
    const index = req.files ? req.files.length : 0;
    const ext = path.extname(file.originalname);
    cb(
      null,
      `image_${String(index + 1).padStart(3, '0')}${ext}`,
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WEBP are allowed.`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 10, // max 10 images per analysis
  },
});

module.exports = { upload, UPLOADS_DIR };
