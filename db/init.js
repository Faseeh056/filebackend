import { db, client } from './config.js'
import { uploads, results, requirements } from './schema.js'

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

async function createTables() {
  console.log('Creating database tables...')
  
  // Create uploads table
  await client`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER NOT NULL,
      file_type VARCHAR(100),
      uploaded_at TIMESTAMP DEFAULT NOW(),
      user_id VARCHAR(100) DEFAULT 'default_user'
    )
  `
  
  // Create results table
  await client`
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
      configured BOOLEAN DEFAULT false,
      issues_detected INTEGER DEFAULT 0,
      report_path VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  
  // Create requirements table
  await client`
    CREATE TABLE IF NOT EXISTS requirements (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  
  console.log('✓ Database tables created successfully')
}

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
        console.log('Tables do not exist, creating them...')
        // Tables don't exist, create them
        await createTables()
        
        // Now seed default requirements
        console.log('Seeding default requirements...')
        for (const description of defaultRequirements) {
          await db.insert(requirements).values({ description })
        }
        console.log('Default requirements inserted')
      } else {
        throw tableError
      }
    }

    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    // Don't throw - allow server to start even if DB init fails
    console.warn('Continuing with server startup despite database initialization warning')
  }
}