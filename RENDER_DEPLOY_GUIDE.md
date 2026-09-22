# Render.com Free Deployment Guide (100% Free Forever)

This repository is now fully configured for **1-Click Free Deployment** on [Render.com](https://render.com).

---

## Why this configuration is 100% Free:
* Render provides **750 free instance hours per month**.
* We packaged both **Next.js Frontend** and **NestJS Backend** into a **single unified container**.
* This consumes only **1 service = 750 hours/month = $0.00 / Free forever**.
* Both Frontend, Backend, SQLite Database, and Gupshup Webhooks run on the same instance with zero latency.

---

## Step 1: Deploy on Render (1-Click Blueprint)

1. Log in to [Render.com](https://render.com) using your GitHub account.
2. In the top right, click **New +** ➔ **Blueprint**.
3. Select your repository: `singhemant666-jpg/mpc-inbox`.
4. Render will automatically read `render.yaml` and configure:
   - **Service Name**: `mpc-inbox`
   - **Runtime**: Docker (`Dockerfile`)
   - **Plan**: `Free`
   - **Environment Variables**: pre-filled with your Gupshup API keys and settings.
5. Click **Apply**.
6. Render will build and deploy the container (~3–4 minutes).
7. Once deployed, Render will display your permanent public HTTPS URL:
   ```text
   https://mpc-inbox-xxxx.onrender.com
   ```

---

## Step 2: Prevent Render Free Tier from Sleeping (24/7 Keep-Alive)

Render free tier instances enter sleep mode after 15 minutes of inactivity. To ensure WhatsApp customer replies and status updates are received instantly:

1. Sign up for free at [UptimeRobot.com](https://uptimerobot.com) (or [Cron-job.org](https://cron-job.org)).
2. Click **+ Add New Monitor**.
3. Fill in:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `MPC Inbox Healthcheck`
   - **URL**: `https://YOUR-RENDER-URL.onrender.com/api/webhook/gupshup`
   - **Monitoring Interval**: `Every 10 minutes`
4. Click **Create Monitor**.
5. **Result**: UptimeRobot will ping your server every 10 minutes, keeping your inbox and Gupshup webhook online 24/7 for free!

---

## Step 3: Update Gupshup Webhook URL

Now that you have a permanent HTTPS URL, you no longer need `ngrok`!

1. Open your [Gupshup Dashboard](https://enterprise.gupshup.io).
2. Go to **WhatsApp Business API** ➔ App `mpcUAT`.
3. Locate **Webhook Settings** / **Callback URL**.
4. Set the Callback URL to:
   ```text
   https://YOUR-RENDER-URL.onrender.com/api/webhook/gupshup
   ```
5. Click **Save** / **Verify**.

---

## Live URLs After Deployment:

* **Patient Inbox**: `https://YOUR-RENDER-URL.onrender.com/inbox`
* **Marketing Broadcast**: `https://YOUR-RENDER-URL.onrender.com/broadcast`
* **Webhook Endpoint**: `https://YOUR-RENDER-URL.onrender.com/api/webhook/gupshup`
