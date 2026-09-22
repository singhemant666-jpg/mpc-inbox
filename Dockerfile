FROM node:22-slim AS runner

# Install essential native utilities for Prisma and OpenSSL
RUN apt-get update && apt-get install -y openssl ca-certificates curl wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Build & Setup Backend
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
WORKDIR /app/backend
RUN npm install
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# 2. Build & Setup Frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BACKEND_INTERNAL_URL=http://127.0.0.1:3001
RUN npm run build

# 3. Setup Runner
WORKDIR /app
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["/bin/sh", "/app/start.sh"]
