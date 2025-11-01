import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:faseeh565@localhost:5432/project'

console.log('Initializing local PostgreSQL database...')
console.log('Connection:', connectionString.replace(/:[^:@]+@/, ':***@'))

const client = postgres(connectionString, { max: 1 })

try {
  // Create tables
  console.log('Creating tables...')
  
  await client`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size INTEGER NOT NULL,
      file_type VARCHAR(100),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id VARCHAR(100) DEFAULT 'default_user'
    )
  `
  console.log('✓ uploads table created')
  
  await client`
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
      configured BOOLEAN DEFAULT FALSE,
      issues_detected INTEGER DEFAULT 0,
      report_path VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
  console.log('✓ results table created')
  
  await client`
    CREATE TABLE IF NOT EXISTS requirements (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
  console.log('✓ requirements table created')
  
  // Insert default requirements
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
  
  console.log('Inserting default requirements...')
  for (const desc of defaultRequirements) {
    await client`
      INSERT INTO requirements (description)
      SELECT ${desc}
      WHERE NOT EXISTS (
        SELECT 1 FROM requirements WHERE description = ${desc}
      )
    `
  }
  console.log('✓ Default requirements inserted')
  
  // Verify
  const [count] = await client`SELECT COUNT(*) as cnt FROM requirements`
  console.log(`✓ Total requirements: ${count.cnt}`)
  
  await client.end()
  console.log('\n✓ Local database initialized successfully!')
  process.exit(0)
} catch (error) {
  console.error('✗ Error:', error.message)
  console.error('  Code:', error.code)
  await client.end()
  process.exit(1)
}
