import dotenv from 'dotenv'

dotenv.config()

export default {
  schema: './db/schema.js',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:faseeh565@localhost:5432/project',
  },
}
