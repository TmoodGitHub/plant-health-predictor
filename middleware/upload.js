const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': {
    extension: '.jpg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  'image/png': {
    extension: '.png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  'image/webp': {
    extension: '.webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
};

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
    const index = req.files ? req.files.length : 0;
    const type = ALLOWED_IMAGE_TYPES[file.mimetype];
    cb(
      null,
      `image_${String(index + 1).padStart(3, '0')}${type.extension}`,
    );
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES[file.mimetype]) {
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

const validateUploadedImages = async (files) => {
  const invalidFiles = [];

  await Promise.all(
    files.map(async (file) => {
      const type = ALLOWED_IMAGE_TYPES[file.mimetype];
      if (!type) {
        invalidFiles.push(file.originalname);
        return;
      }

      const handle = await fs.promises.open(file.path, 'r');
      try {
        const buffer = Buffer.alloc(16);
        const { bytesRead } = await handle.read(
          buffer,
          0,
          buffer.length,
          0,
        );
        if (!type.matches(buffer.subarray(0, bytesRead))) {
          invalidFiles.push(file.originalname);
        }
      } finally {
        await handle.close();
      }
    }),
  );

  if (invalidFiles.length > 0) {
    const error = new Error(
      `Invalid image file content: ${invalidFiles.join(', ')}`,
    );
    error.statusCode = 400;
    throw error;
  }
};

const cleanupUploadedFiles = async (sessionId) => {
  if (!sessionId) return;
  const sessionDir = path.join(UPLOADS_DIR, sessionId);
  await fs.promises.rm(sessionDir, {
    recursive: true,
    force: true,
  });
};

module.exports = {
  upload,
  UPLOADS_DIR,
  validateUploadedImages,
  cleanupUploadedFiles,
};
