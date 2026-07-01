# WhatsApp Patient Inbox — My Pain Clinic Global

Standalone WhatsApp inbox for clinic staff to view and reply to patient messages via Gupshup API.

## Architecture

- **Backend:** NestJS + Prisma + PostgreSQL + Socket.IO
- **Frontend:** Next.js 15 + React 19 + Tailwind CSS
- **WhatsApp:** Gupshup BSP API

## Quick Start

### 1. Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL & Redis)

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Backend Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed          # Creates admin user + sample data
npm run dev           # Starts on http://localhost:3001
```

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev           # Starts on http://localhost:3000
```

### 5. Login

- **Email:** admin@mypainclnic.com
- **Password:** admin123

## Environment Variables

### Backend (.env)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `GUPSHUP_API_KEY` | Gupshup API key |
| `GUPSHUP_APP_NAME` | Gupshup app name |
| `GUPSHUP_SOURCE_NUMBER` | Your WhatsApp Business number |
| `PORT` | Backend port (default: 3001) |
| `CORS_ORIGIN` | Frontend URL (default: http://localhost:3000) |

### Frontend (.env.local)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | Backend WebSocket URL |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/webhook/gupshup` | Gupshup webhook receiver |
| POST | `/api/auth/login` | Staff login |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/:id/messages` | Get messages |
| POST | `/api/messages/send` | Send reply |
| POST | `/api/conversations/read` | Mark as read |

## Gupshup Webhook Setup

1. Go to your Gupshup Dashboard
2. Navigate to **Settings > Webhook**
3. Set callback URL to: `https://your-domain.com/api/webhook/gupshup`
4. Enable message events
