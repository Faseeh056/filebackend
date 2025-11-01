# Battery Compliance Backend

Backend API for the Battery Compliance Management System.

## Tech Stack

- **Node.js** (v18+)
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Drizzle ORM** - Database toolkit
- **Multer** - File upload handling

## Environment Variables

Copy `env.example` to `.env` and configure the following:

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_URL` - PostgreSQL connection string
- `CORS_ORIGIN` - Allowed CORS origins (comma-separated)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your local database configuration
```

3. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

## Database Commands

- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio

## Railway Deployment

This backend is configured for deployment on Railway.

### Setup on Railway

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add a PostgreSQL service to your project
4. Railway will automatically:
   - Detect the Node.js application
   - Install dependencies
   - Start the server using the `start` script
   - Inject the `DATABASE_URL` environment variable

### Environment Variables on Railway

Set the following in Railway's environment variables:

- `CORS_ORIGIN` - Your frontend URL (e.g., `https://your-app.vercel.app`)
- `NODE_ENV` - Set to `production`
- `PORT` - Railway automatically sets this, but you can override if needed

**Note:** `DATABASE_URL` is automatically provided by Railway when you add a PostgreSQL service.

### API Endpoints

- `GET /` - Health check
- `GET /api/health` - Detailed health check
- `POST /api/upload` - Upload files
- `GET /api/results` - Get analysis results
- `POST /api/requirements` - Manage requirements

## Project Structure

```
backend/
├── db/           # Database configuration and migrations
├── routes/       # API routes
├── uploads/      # Uploaded files (not in git)
├── server.js     # Main server file
└── package.json  # Dependencies and scripts
```
