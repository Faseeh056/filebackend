#!/bin/bash

# Start Docker containers
echo "Starting Docker containers..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Generate and run migrations
echo "Generating migrations..."
npm run db:generate

echo "Running migrations..."
npm run db:migrate

echo "Database is ready!"
echo "You can now:"
echo "1. Start the backend: npm run dev"
echo "2. Open Drizzle Studio: npm run db:studio"
