#!/bin/sh
set -e

echo "🚀 Starting MPC Inbox Backend (NestJS)..."
cd /app/backend
npx prisma db push --skip-generate || true
node dist/src/main || node dist/main &

echo "⏳ Waiting for backend to initialize on port 3001..."
sleep 4

echo "🌐 Starting MPC Inbox Frontend (Next.js) on port ${PORT:-3000}..."
cd /app/frontend
exec npx next start -p ${PORT:-3000} -H 0.0.0.0
