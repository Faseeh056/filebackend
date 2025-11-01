import postgres from 'postgres'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/file_management'

const newGuidelines = [
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

async function updateRequirements() {
  console.log('Updating requirements in database...')
  console.log('Connection:', connectionString.replace(/:[^:@]+@/, ':***@'))

  const client = postgres(connectionString, { max: 1 })

  try {
    // Delete all existing requirements
    console.log('Deleting all old requirements...')
    await client`DELETE FROM requirements`
    console.log('✓ Old requirements deleted')

    // Reset the ID sequence to start from 1
    console.log('Resetting ID sequence to start from 1...')
    await client`ALTER SEQUENCE requirements_id_seq RESTART WITH 1`
    console.log('✓ ID sequence reset')

    // Insert new guidelines
    console.log('Inserting new guidelines...')
    for (const guideline of newGuidelines) {
      await client`INSERT INTO requirements (description) VALUES (${guideline})`
    }
    console.log(`✓ ${newGuidelines.length} new guidelines inserted`)

    // Verify IDs start from 1
    const allRequirements = await client`SELECT id, description FROM requirements ORDER BY id`
    console.log('\n✓ Guidelines in database:')
    allRequirements.forEach(req => {
      console.log(`  ID ${req.id}: ${req.description}`)
    })

    console.log(`\n✓ Total guidelines in database: ${allRequirements.length}`)
    console.log('\n✓ Requirements updated successfully!')
  } catch (error) {
    console.error('✗ Error updating requirements:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

updateRequirements()

