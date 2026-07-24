# Production Deployment Guide: AWS

This guide outlines the step-by-step instructions to deploy the **WhatsApp Patient Inbox** project (Next.js frontend, NestJS backend, and PostgreSQL database) to **AWS**.

---

## Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [Database Setup (AWS RDS)](#3-database-setup-aws-rds)
4. [Deployment Option A: AWS EC2 + Docker Compose (Recommended/Simplest)](#4-deployment-option-a-aws-ec2--docker-compose-recommendedsimplest)
5. [Deployment Option B: AWS ECS Fargate + Amplify (Scaleable/Cloud-Native)](#5-deployment-option-b-aws-ecs-fargate--amplify-scaleablecloud-native)
6. [Updating Gupshup Webhooks](#6-updating-gupshup-webhooks)
7. [Production Validation Checklist](#7-production-validation-checklist)

---

## 1. Prerequisites
* A custom domain name (e.g., `yourdomain.com`).
* An active **AWS Account**.
* A production **Gupshup** developer account.
* Docker & Docker Compose installed on your deployment server (if choosing Option A).

---

## 2. Environment Configuration

### Backend Environment (`backend/.env`)
Create a production `.env` file on your AWS server. Change these settings to secure production values:

```env
# Database (Point to your production RDS or secure database)
DATABASE_URL="postgresql://inbox_user:STRONG_SECURE_PASSWORD@your-rds-endpoint.amazonaws.com:5432/mpc_inbox?schema=public"

# JWT Token Security (Must change to a long random secret key!)
JWT_SECRET="generate-a-secure-32-character-secret-key-here"
JWT_EXPIRATION="24h"

# Gupshup WhatsApp API (Production keys)
GUPSHUP_API_KEY="your-production-gupshup-api-key"
GUPSHUP_APP_NAME="your-production-app-name"
GUPSHUP_SOURCE_NUMBER="your-production-source-number"
GUPSHUP_WEBHOOK_SECRET="optional-webhook-signature-secret"

# Application Settings
PORT=3001
NODE_ENV=production

# CORS (Allow ONLY your production frontend URL!)
CORS_ORIGIN="https://inbox.yourdomain.com"

# Admin Seeds (Set strong passwords for initial setup)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD="ChooseAStrongAdminPassword123!"
ADMIN_NAME="Clinic Admin"

SUPER_ADMIN_EMAIL=superadmin@yourdomain.com
SUPER_ADMIN_PASSWORD="ChooseAStrongSuperAdminPassword123!"
SUPER_ADMIN_NAME="Super Admin"

LEADS_EMAIL=leads@yourdomain.com
LEADS_PASSWORD="ChooseAStrongLeadsPassword123!"
LEADS_NAME="Leads Manager"
```

### Frontend Configuration

Depending on your deployment structure, configure the frontend API calls:

#### Scenario 1: Frontend and Backend on same server (Proxied through Next.js)
If you host both on the same EC2 instance behind an Nginx reverse proxy, you can keep **relative URLs**:
* **`frontend/.env.production`**:
  ```env
  NEXT_PUBLIC_API_URL=/api
  NEXT_PUBLIC_WS_URL=
  ```
* **`frontend/next.config.js`**: Update the localhost targets to the Docker container or local IP:
  ```javascript
  destination: 'http://localhost:3001/api/:path*'
  ```

#### Scenario 2: Frontend on AWS Amplify, Backend on EC2/App Runner
If they are hosted on different systems:
* **`frontend/.env.production`**:
  ```env
  NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
  NEXT_PUBLIC_WS_URL=https://api.yourdomain.com
  ```

---

## 3. Database Setup (AWS RDS)
Instead of running PostgreSQL in Docker, it is recommended to use **AWS RDS (Relational Database Service)** for automated backups and scaling.

1. Create a PostgreSQL database instance in your AWS RDS console (Postgres v16+).
2. Configure the **Inbound Security Group** of the RDS database to allow traffic from your EC2 instance / container on port `5432`.
3. Push your Prisma database schema from your local environment to the RDS database:
   ```bash
   npx prisma db push --schema=./backend/prisma/schema.prisma
   ```

---

## 4. Deployment Option A: AWS EC2 + Docker Compose (Recommended/Simplest)
This option uses a virtual machine instance running Nginx as a reverse proxy, handling SSL (HTTPS) automatically.

### Step 1: Launch an EC2 Instance
* Create a **t3.medium** EC2 Instance running **Ubuntu 22.04 LTS**.
* Open these ports in the Security Group:
  * `22` (SSH)
  * `80` (HTTP)
  * `443` (HTTPS)

### Step 2: Install Docker and Docker Compose
Run the following commands on the EC2 instance terminal:
```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
```

### Step 3: Nginx Reverse Proxy Config (`nginx.conf`)
Create a reverse proxy file to route traffic to the Next.js port (`3000`) and handle WebSockets:

```nginx
server {
    server_name inbox.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy WebSocket connection
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### Step 4: Get a Free SSL Certificate (HTTPS)
Use Certbot on your EC2 instance to generate SSL certificates:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d inbox.yourdomain.com
```

### Step 5: Start the Containers
Clone your project onto the EC2 server and launch the Docker Compose file:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 5. Deployment Option B: AWS ECS Fargate + Amplify (Scaleable/Cloud-Native)

This option decouples the frontend and backend, hosting them on fully managed AWS services:

1. **Frontend (Next.js):**
   * Connect your GitHub repository to **AWS Amplify**.
   * Amplify will automatically build and serve the frontend globally via AWS CloudFront CDN.
   
2. **Backend (Next.js):**
   * Build the backend into a Docker image and push it to **AWS ECR (Elastic Container Registry)**.
   * Run the container serverless on **AWS ECS Fargate**.
   * Map the backend behind an **Application Load Balancer (ALB)** with an HTTPS listener.

---

## 6. Updating Gupshup Webhooks
Once your AWS server is live and running HTTPS:
1. Log in to your **Gupshup Dashboard**.
2. Select your WhatsApp API App.
3. Locate the **Callback URL / Webhook** section.
4. Set the Callback URL to:
   `https://inbox.yourdomain.com/api/webhook/gupshup`
5. Click **Verify and Save**. Send a message from a test WhatsApp account to verify that it is successfully hitting your server.

---

## 7. Production Validation Checklist
* [ ] Verify that visiting `https://inbox.yourdomain.com/login` loads over HTTPS with a valid certificate.
* [ ] Check that Socket.IO initializes correctly in the browser DevTools (no console errors or 404s).
* [ ] Send a test WhatsApp message from a patient phone and confirm it arrives in the Leads panel in real-time.
* [ ] Test reacting to a message on WhatsApp and confirm the reaction pill renders correctly on the corresponding chat bubble.
* [ ] Try downloading a received image and audio file to confirm AWS CORS policies do not block downloads.
