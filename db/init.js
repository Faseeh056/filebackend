import { db } from './config.js'
import { uploads, results, requirements } from './schema.js'
import { sql } from 'drizzle-orm'

const defaultRequirements = [
  'Maximum file size per upload is 20 MB.',
  'Supported file formats: txt, pdf, docx, csv, xlsx, html, jpg, jpeg, png, gif.',
  'Multiple files can be selected and uploaded simultaneously.',
  'Upload progress is displayed in real-time for each file.',
  'Image files (jpg, jpeg, png, gif) are automatically embedded in PDF format when downloaded.',
  'Text files (txt, csv, html) are converted to PDF with preserved content when downloaded.',
  'PDF files are downloaded as-is without any conversion or modification.',
  'Downloaded files maintain the original filename with .pdf extension.',
  'Files can be deleted from the results page using the delete button.',
  'Uploaded files are stored securely on the server until deleted.',
  'Image preview is available for image files during upload.',
  'File information including name, size, and type is displayed in the results table.',
  'All uploaded files can be downloaded in PDF format from the results page.',
]

export async function initDB() {
  try {
    console.log('Initializing database tables...')
    
    // Check if tables exist by trying to query them
    try {
      const existingRequirements = await db.select().from(requirements).limit(1)
      
      if (existingRequirements.length === 0) {
        console.log('Seeding default requirements...')
        for (const description of defaultRequirements) {
          await db.insert(requirements).values({ description })
        }
        console.log('Default requirements inserted')
      } else {
        console.log('Requirements already exist, skipping seed')
      }
    } catch (tableError) {
      if (tableError.code === '42P01') {
        console.error('ERROR: Database tables do not exist!')
        console.error('Please create the tables first using:')
        console.error('  docker exec file-management-db psql -U postgres -d project -f /path/to/schema.sql')
        console.error('Or run: npm run db:push')
        // Don't throw, just warn - server can still start
        console.warn('Server will start but database operations may fail until tables are created')
        return
      }
      throw tableError
    }

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    // Don't throw - allow server to start even if DB init fails
    console.warn('Continuing with server startup despite database initialization warning')
  }
}