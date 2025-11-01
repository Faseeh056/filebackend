import express from 'express'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { dirname, join, extname } from 'path'
import fs from 'fs'
import { db, client } from '../db/config.js'
import { uploads, results } from '../db/schema.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Ensure uploads directory exists
const uploadsDir = join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = extname(file.originalname)
    cb(null, file.fieldname + '-' + uniqueSuffix + ext)
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/html',
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Allowed types: txt, pdf, docx, csv, xlsx, html, jpg, jpeg, png, gif'))
    }
  },
})

// Upload endpoint
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' })
    }

    const { filename, originalname, size, mimetype } = req.file

    // Store relative path (just filename) to avoid issues with absolute paths on different environments
    const relativePath = filename // Just the filename, stored in uploads directory
    
    // Insert upload record into database using raw SQL
    const [uploadRecord] = await client`
      INSERT INTO uploads (filename, original_filename, file_path, file_size, file_type)
      VALUES (${filename}, ${originalname}, ${relativePath}, ${size}, ${mimetype})
      RETURNING id, filename, original_filename as "originalFilename", file_path as "filePath", 
                 file_size as "fileSize", file_type as "fileType", uploaded_at as "uploadedAt", user_id as "userId"
    `

    // Create a result entry for this upload
    const issuesDetected = Math.floor(Math.random() * 5) // Mock: 0-4 issues
    const [resultRecord] = await client`
      INSERT INTO results (upload_id, issues_detected)
      VALUES (${uploadRecord.id}, ${issuesDetected})
      RETURNING id, upload_id as "uploadId", configured, issues_detected as "issuesDetected", 
                 report_path as "reportPath", created_at as "createdAt", updated_at as "updatedAt"
    `

    res.json({
      success: true,
      message: 'File uploaded successfully',
      upload: uploadRecord,
      result: resultRecord,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message })
  }
})

export default router
