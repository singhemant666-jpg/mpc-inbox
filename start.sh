#!/bin/sh
set -e

echo "🚀 Syncing Prisma DB schema..."
cd /app/backend
npx prisma db push --skip-generate || echo "Prisma db push completed or skipped"

echo "🚀 Starting MPC Inbox Backend (NestJS) on internal port 3001..."
(BACKEND_PORT=3001 PORT=3001 node dist/src/main || BACKEND_PORT=3001 PORT=3001 node dist/main) &

echo "⏳ Waiting for backend to be ready on port 3001..."
for i in $(seq 1 30); do
  if wget -q -O - http://127.0.0.1:3001/api/webhook/gupshup > /dev/null 2>&1 || curl -s http://127.0.0.1:3001/api/webhook/gupshup > /dev/null 2>&1; then
    echo "✅ Backend is ready on port 3001!"
    break
  fi
  sleep 1
done

echo "🌐 Starting MPC Inbox Frontend (Next.js) on port ${PORT:-3000}..."
cd /app/frontend
exec npx next start -p ${PORT:-3000} -H 0.0.0.0
