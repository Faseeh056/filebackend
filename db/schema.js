import { pgTable, serial, varchar, integer, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const uploads = pgTable('uploads', {
  id: serial('id').primaryKey(),
  filename: varchar('filename', { length: 255 }).notNull(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: integer('file_size').notNull(),
  fileType: varchar('file_type', { length: 100 }),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  userId: varchar('user_id', { length: 100 }).default('default_user'),
})

export const results = pgTable('results', {
  id: serial('id').primaryKey(),
  uploadId: integer('upload_id').references(() => uploads.id, { onDelete: 'cascade' }),
  configured: boolean('configured').default(false),
  issuesDetected: integer('issues_detected').default(0),
  reportPath: varchar('report_path', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const requirements = pgTable('requirements', {
  id: serial('id').primaryKey(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  idIdx: table.id,
}))
