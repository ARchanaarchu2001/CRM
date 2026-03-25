import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Set up destination directory conditionally checking if it exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Configure Storage Parameters
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Store uploaded files firmly inside 'uploads/'
    cb(null, uploadDir); 
  },
  filename: function (req, file, cb) {
    // Create a robust unique string to prevent collisons
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // Extrapolate safe extension
    const ext = path.extname(file.originalname);
    // Final Output example: profilePhoto-16982138123-1283921.jpg
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// 2. Add File Type Verification
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|webp/;
  
  // Test file extension and mime type securely
  const extname = allowedFileTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type! Only JPG, JPEG, PNG and WEBP image formats are allowed.'), false);
  }
};

// 3. Initialize Unified Exportable Middleware 
export const uploadProfilePhoto = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Explicit limit exactly max 5MB 
  },
});
