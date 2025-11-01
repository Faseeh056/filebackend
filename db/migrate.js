import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './config.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function runMigrations() {
  try {
    console.log('Running migrations...')
    const migrationsFolder = join(__dirname, '..', 'drizzle')
    await migrate(db, { migrationsFolder })
    console.log('Migrations completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

runMigrations()
