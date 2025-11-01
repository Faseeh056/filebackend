import express from 'express'
import { db, client } from '../db/config.js'
import { results, uploads, requirements } from '../db/schema.js'
import { eq, desc, sql } from 'drizzle-orm'
import PDFDocument from 'pdfkit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const reportsDir = join(__dirname, '..', 'reports')
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true })
}

// Get all results
router.get('/', async (req, res) => {
  try {
    // Use raw SQL to bypass Drizzle schema mapping issues
    const allResults = await client`
      SELECT 
        r.id,
        r.upload_id as "uploadId",
        r.configured,
        r.issues_detected as "issuesDetected",
        r.created_at as "createdAt",
        u.original_filename as "originalFilename",
        u.file_path as "filePath",
        u.file_size as "fileSize",
        u.file_type as "fileType"
      FROM results r
      LEFT JOIN uploads u ON r.upload_id = u.id
      ORDER BY r.created_at DESC
    `

    const formattedResults = allResults.map((row) => ({
      id: row.id,
      filename: row.originalFilename || 'Unknown',
      image_url: row.filePath ? `/uploads/${row.filePath.split(/[/\\]/).pop()}` : null,
      configured: row.configured || false,
      issues_detected: row.issuesDetected || 0,
      created_at: row.createdAt,
    }))

    res.json({ success: true, results: formattedResults })
  } catch (error) {
    console.error('Error fetching results:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch results', error: error.message })
  }
})

// Generate and download PDF report (must be before /:id route)
// Using explicit route pattern to ensure it matches correctly
router.get('/:id/download', async (req, res) => {
  console.log(`[DOWNLOAD] Route matched! ID: ${req.params.id}, Path: ${req.path}, URL: ${req.originalUrl}, Method: ${req.method}`)
  try {
    const { id } = req.params
    const parsedId = parseInt(id)
    
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: 'Invalid result ID' })
    }
    
    console.log(`[DOWNLOAD] Processing download for result ID: ${parsedId}`)

    // Fetch result data using raw SQL
    const resultQuery = await client`
      SELECT 
        r.*,
        u.original_filename,
        u.file_path,
        u.file_size,
        u.file_type,
        u.uploaded_at
      FROM results r
      LEFT JOIN uploads u ON r.upload_id = u.id
      WHERE r.id = ${parsedId}
      LIMIT 1
    `

    if (resultQuery.length === 0) {
      return res.status(404).json({ success: false, message: 'Result not found' })
    }

    const [resultData] = resultQuery
    const resultDataFormatted = {
      ...resultData,
      original_filename: resultData.original_filename,
      file_path: resultData.file_path,
      file_size: resultData.file_size,
      file_type: resultData.file_type,
      uploaded_at: resultData.uploaded_at,
    }

    // Check if file exists
    const storedPath = resultDataFormatted.file_path
    const fileType = resultDataFormatted.file_type || ''
    const originalName = resultDataFormatted.original_filename || `file_${parsedId}`
    
    // Resolve file path - handle both absolute paths and relative filenames
    // Check multiple possible locations for uploaded files
    const backendUploadsDir = join(__dirname, '..', 'uploads') // backend/uploads
    const rootUploadsDir = join(__dirname, '..', '..', 'uploads') // root/uploads (where files actually are)
    
    // Ensure uploads directories exist
    if (!fs.existsSync(backendUploadsDir)) {
      fs.mkdirSync(backendUploadsDir, { recursive: true })
    }
    if (!fs.existsSync(rootUploadsDir)) {
      fs.mkdirSync(rootUploadsDir, { recursive: true })
    }
    
    let filePath = null
    
    // First, check if the stored path is an absolute path that exists
    if (storedPath && fs.existsSync(storedPath)) {
      filePath = storedPath
      console.log(`[DOWNLOAD] Using stored absolute path: ${filePath}`)
    } else {
      // Extract just the filename from the stored path (in case it's a full path)
      const storedFilename = storedPath ? storedPath.split(/[/\\]/).pop() : null
      if (storedFilename) {
        // Try multiple locations:
        // 1. Root uploads directory (where files actually are)
        const rootPath = join(rootUploadsDir, storedFilename)
        if (fs.existsSync(rootPath)) {
          filePath = rootPath
          console.log(`[DOWNLOAD] Found in root uploads: ${filePath}`)
        }
        // 2. Backend uploads directory
        else {
          const backendPath = join(backendUploadsDir, storedFilename)
          if (fs.existsSync(backendPath)) {
            filePath = backendPath
            console.log(`[DOWNLOAD] Found in backend uploads: ${filePath}`)
          }
        }
        
        // 3. If storedPath is just a filename, try that too
        if (!filePath && storedPath && !storedPath.includes('/') && !storedPath.includes('\\')) {
          const directRootPath = join(rootUploadsDir, storedPath)
          if (fs.existsSync(directRootPath)) {
            filePath = directRootPath
            console.log(`[DOWNLOAD] Found using direct root path: ${filePath}`)
          } else {
            const directBackendPath = join(backendUploadsDir, storedPath)
            if (fs.existsSync(directBackendPath)) {
              filePath = directBackendPath
              console.log(`[DOWNLOAD] Found using direct backend path: ${filePath}`)
            }
          }
        }
      }
    }
    
    if (!filePath || !fs.existsSync(filePath)) {
      console.error('File not found:', {
        storedPath: storedPath,
        filePath: filePath,
        backendUploadsDir: backendUploadsDir,
        rootUploadsDir: rootUploadsDir,
        backendUploadsExists: fs.existsSync(backendUploadsDir),
        rootUploadsExists: fs.existsSync(rootUploadsDir),
        filesInBackendUploads: fs.existsSync(backendUploadsDir) ? fs.readdirSync(backendUploadsDir).slice(0, 5) : 'N/A',
        filesInRootUploads: fs.existsSync(rootUploadsDir) ? fs.readdirSync(rootUploadsDir).slice(0, 5) : 'N/A'
      })
      return res.status(404).json({ 
        success: false, 
        message: 'File not found. The uploaded file may have been removed or the path is incorrect.',
        debug: { 
          storedPath: storedPath, 
          resolvedPath: filePath
        } 
      })
    }

    // If the file is already a PDF, just send it as-is (renamed to original filename)
    if (fileType.includes('application/pdf')) {
      const fileContent = fs.readFileSync(filePath)
      const baseName = originalName.replace(/\.[^/.]+$/, '') // Remove extension
      const pdfFilename = `${baseName}.pdf`
      
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`)
      res.send(fileContent)
      return
    }

    // For other file types, convert to PDF with the same content
    const baseName = originalName.replace(/\.[^/.]+$/, '') // Remove extension
    const pdfFilename = `${baseName}.pdf`
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`)

    // Read file content
    const fileContent = fs.readFileSync(filePath)

    // Create PDF and pipe directly to response
    const doc = new PDFDocument({ margin: 50 })
    doc.pipe(res)

    // Handle different file types and include content
    try {
      // Handle images
      if (fileType.startsWith('image/')) {
        try {
          // Add image to PDF (full page if possible)
          const pageWidth = doc.page.width - 100
          const pageHeight = doc.page.height - 100
          
          doc.image(fileContent, {
            fit: [pageWidth, pageHeight],
            align: 'center',
            valign: 'center'
          })
        } catch (error) {
          console.error('Error adding image to PDF:', error)
          doc.fontSize(12).text('Could not embed image in PDF.', { align: 'center' })
        }
      }
      // Handle text files
      else if (fileType.includes('text/') || fileType.includes('text/plain') || fileType.includes('text/csv') || fileType.includes('text/html')) {
        try {
          const textContent = fileContent.toString('utf-8')
          // Limit text content to prevent PDF from being too large
          const maxTextLength = 500000 // ~500KB of text
          const displayText = textContent.length > maxTextLength 
            ? textContent.substring(0, maxTextLength) + '\n\n[... Content truncated due to length ...]'
            : textContent
          
          doc.fontSize(10).text(displayText, {
            width: doc.page.width - 100,
            align: 'left'
          })
        } catch (error) {
          console.error('Error reading text file:', error)
          doc.fontSize(12).text('Could not read text content.', { align: 'center' })
        }
      }
      // Handle other file types - show as binary/metadata
      else {
        doc.fontSize(12).text(`File Type: ${fileType}`, { align: 'center' })
        doc.moveDown()
        doc.fontSize(10).text('This file type cannot be converted to PDF.', { align: 'center' })
        doc.fontSize(10).text(`File Size: ${(resultDataFormatted.file_size / 1024).toFixed(2)} KB`, { align: 'center' })
      }
    } catch (error) {
      console.error('Error processing file:', error)
      doc.fontSize(12).text('Error processing file content.', { align: 'center' })
    }

    doc.end()
  } catch (error) {
    console.error('Error generating PDF:', error)
    res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message })
  }
})

// Get single result
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await client`
      SELECT 
        r.*,
        u.original_filename as "originalFilename",
        u.file_path as "filePath",
        u.file_size as "fileSize",
        u.file_type as "fileType"
      FROM results r
      LEFT JOIN uploads u ON r.upload_id = u.id
      WHERE r.id = ${parseInt(id)}
      LIMIT 1
    `

    if (result.length === 0) {
      return res.status(404).json({ success: false, message: 'Result not found' })
    }

    const [resultData] = result
    res.json({ 
      success: true, 
      result: resultData
    })
  } catch (error) {
    console.error('Error fetching result:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch result', error: error.message })
  }
})

// Delete result and associated upload
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    console.log(`DELETE request received for result ID: ${id}`)

    // First, get the file path and upload ID
    const resultQuery = await client`
      SELECT 
        r.upload_id,
        u.file_path
      FROM results r
      LEFT JOIN uploads u ON r.upload_id = u.id
      WHERE r.id = ${parseInt(id)}
      LIMIT 1
    `

    console.log(`DELETE query result count: ${resultQuery.length}`)
    
    if (resultQuery.length === 0) {
      console.log(`Result with ID ${id} not found`)
      return res.status(404).json({ success: false, message: 'Result not found' })
    }

    const [resultData] = resultQuery

    // Delete the physical file if it exists
    if (resultData.file_path && fs.existsSync(resultData.file_path)) {
      try {
        fs.unlinkSync(resultData.file_path)
        console.log('Deleted file:', resultData.file_path)
      } catch (fileError) {
        console.warn('Could not delete file:', resultData.file_path, fileError.message)
      }
    }

    // Delete the result record (uploads will be deleted via CASCADE)
    await client`DELETE FROM results WHERE id = ${parseInt(id)}`
    
    console.log(`Result ${id} deleted successfully`)

    res.json({ success: true, message: 'Result deleted successfully' })
  } catch (error) {
    console.error('Error deleting result:', error)
    res.status(500).json({ success: false, message: 'Failed to delete result', error: error.message })
  }
})

export default router
