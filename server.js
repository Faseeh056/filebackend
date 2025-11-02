import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import uploadRoutes from './routes/upload.js'
import resultsRoutes from './routes/results.js'
import requirementsRoutes from './routes/requirements.js'
import { initDB } from './db/init.js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './db/config.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
// CORS configuration - allow all origins for better compatibility
// For better security, set CORS_ORIGIN env var with specific origins
const corsOriginEnv = process.env.CORS_ORIGIN
let allowedOrigins = true // Default: allow all origins

if (corsOriginEnv) {
  // Parse comma-separated origins and trim whitespace
  allowedOrigins = corsOriginEnv.split(',').map(o => o.trim()).filter(o => o.length > 0)
  console.log('✅ CORS configured with origins:', allowedOrigins)
  console.log('📝 CORS_ORIGIN environment variable:', corsOriginEnv)
} else {
  console.log('⚠️ CORS configured to allow all origins (CORS_ORIGIN not set)')
  console.log('💡 Set CORS_ORIGIN environment variable in Railway to restrict origins')
}

// Manual CORS headers middleware - Force correct CORS headers FIRST
// This runs before cors() middleware to ensure headers are set correctly
app.use((req, res, next) => {
  const origin = req.headers.origin
  
  // If specific origins are configured, use them
  if (allowedOrigins !== true && Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
    // If request origin matches allowed origins, use it
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      console.log(`✅ CORS: Allowing origin: ${origin}`)
    } else if (origin) {
      // Origin provided but not in allowed list - still set first allowed origin for preflight
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0])
      console.warn(`⚠️ CORS: Request origin ${origin} not in allowed list. Using: ${allowedOrigins[0]}`)
    } else {
      // No origin header (preflight) - use first allowed origin
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0])
    }
  } else {
    // Allow all origins if not configured
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Max-Age', '86400') // 24 hours
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log(`✅ CORS: Handled OPTIONS preflight for origin: ${origin || 'none'}`)
    return res.status(200).end()
  }
  
  next()
})

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true)
    }
    
    if (allowedOrigins === true) {
      // Allow all origins if CORS_ORIGIN is not set
      return callback(null, true)
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static files for uploaded images
app.use('/uploads', express.static(join(__dirname, 'uploads')))

// Routes
app.use('/api/upload', uploadRoutes)
app.use('/api/results', resultsRoutes)
app.use('/api/requirements', requirementsRoutes)

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Root endpoint for basic connectivity check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'File Management API is running',
    timestamp: new Date().toISOString()
  })
})

// Keep-alive endpoint - ping this regularly to prevent Railway sleep
app.get('/api/keepalive', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is alive',
    timestamp: new Date().toISOString()
  })
})

// Debug endpoint to check CORS configuration
app.get('/api/debug/cors', (req, res) => {
  res.json({
    corsOrigin: process.env.CORS_ORIGIN || 'Not set (allowing all origins)',
    allowedOrigins: allowedOrigins === true ? 'All origins' : allowedOrigins,
    requestOrigin: req.headers.origin || 'No origin header',
    environment: process.env.NODE_ENV || 'development'
  })
})

// Auto keep-alive service - uploads small file every 10 minutes to prevent Railway sleep
async function setupKeepAlive() {
  // Only run in production and if enabled
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_KEEPALIVE !== 'true') {
    const KEEPALIVE_INTERVAL = 10 * 60 * 1000 // 10 minutes in milliseconds
    
    const performKeepAlive = async () => {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const FormData = (await import('form-data')).default
        
        // Create a small keep-alive file (~0.5KB)
        // Fill with content to make it approximately 512 bytes
        const keepAliveContent = 'Keep-alive file to prevent Railway service sleep. ' + 
                                 'Generated at: ' + new Date().toISOString() + '. ' +
                                 'This file is automatically uploaded every 10 minutes to keep the service active. ' +
                                 'File size: ~512 bytes. '.repeat(3)
        
        const keepAliveDir = path.join(__dirname, 'uploads')
        // Ensure uploads directory exists
        if (!fs.existsSync(keepAliveDir)) {
          fs.mkdirSync(keepAliveDir, { recursive: true })
        }
        
        const keepAlivePath = path.join(keepAliveDir, `keep-alive-${Date.now()}.txt`)
        fs.writeFileSync(keepAlivePath, keepAliveContent)
        
        // Prepare form data for upload
        const formData = new FormData()
        formData.append('file', fs.createReadStream(keepAlivePath), {
          filename: `keep-alive-${Date.now()}.txt`,
          contentType: 'text/plain'
        })
        
        // Make internal request to upload endpoint
        const response = await fetch(`http://localhost:${PORT}/api/upload`, {
          method: 'POST',
          body: formData,
          headers: formData.getHeaders()
        })
        
        const result = await response.json()
        
        // Clean up the temporary file
        if (fs.existsSync(keepAlivePath)) {
          try {
            fs.unlinkSync(keepAlivePath)
          } catch (unlinkError) {
            // Ignore cleanup errors
          }
        }
        
        if (result.success) {
          console.log(`✅ Keep-alive upload successful at ${new Date().toISOString()} (File ID: ${result.upload?.id})`)
        } else {
          console.warn(`⚠️ Keep-alive upload returned error: ${result.message || 'Unknown error'}`)
        }
      } catch (error) {
        // Don't throw - keep-alive failures shouldn't crash the server
        console.warn(`⚠️ Keep-alive upload failed (non-critical): ${error.message}`)
      }
    }
    
    // Start keep-alive immediately after server starts (wait 30 seconds for server to be ready)
    setTimeout(() => {
      console.log('🔄 Keep-alive service starting - will upload small file every 10 minutes')
      performKeepAlive()
    }, 30000) // Wait 30 seconds after server starts
    
    // Then run every 10 minutes
    setInterval(performKeepAlive, KEEPALIVE_INTERVAL)
  } else {
    console.log('ℹ️ Keep-alive service disabled (NODE_ENV is not production or DISABLE_KEEPALIVE is set)')
  }
}

// Initialize database on startup
async function startServer() {
  try {
    // Try to run migrations if they exist, otherwise just initialize data
    console.log('Checking database...')
    try {
      const migrationsFolder = join(__dirname, 'drizzle')
      const fs = await import('fs')
      if (fs.existsSync(migrationsFolder)) {
        console.log('Running database migrations...')
        await migrate(db, { migrationsFolder })
        console.log('Migrations completed successfully')
      } else {
        console.log('No migrations folder found, skipping migrations')
      }
    } catch (migrationError) {
      console.warn('Migration warning:', migrationError.message)
      console.log('Continuing with database initialization...')
    }
    
    // Initialize data
    await initDB()
    console.log('Database initialized successfully')
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`)
      console.log(`Run 'npm run db:studio' to open Drizzle Studio`)
      
      // Start keep-alive service
      setupKeepAlive()
    })
  } catch (error) {
    console.error('Failed to initialize database:', error)
    // Try to start server anyway
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} (database may not be fully initialized)`)
      
      // Start keep-alive service
      setupKeepAlive()
    })
  }
}

startServer()
