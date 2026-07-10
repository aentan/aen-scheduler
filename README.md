# AEN Scheduler

A personal scheduling assistant (Calendly alternative). Visitors book time slots on your public booking page; events are created in your Google Calendar with conflict checking, buffers, and email notifications.

## Stack

- **Frontend** — React + Vite + Tailwind CSS (`frontend/`)
- **Backend** — NestJS + Prisma + PostgreSQL (`backend/`)
- **Integrations** — Google Calendar (multi-account), Resend (email)
- **Deployment** — Fly.io (`aen-scheduler`), single container serving API + built frontend

## Features

- **Slots** — bookable meeting types with duration, buffers before/after, max per day, min/max advance windows, working-hours overrides, and meeting links (Google Meet auto-created or custom)
- **Availability** — weekly working hours, recurring breaks, holidays/time off
- **Booking pages** — public pages at `/book/:slug/:slotSlug`, a landing page listing all slots at `/book/:slug`, and custom domain support (e.g. `meet.aen.is`) with slot pages at `/:slotSlug`
- **Bookings** — attendee flow with slot locking, reschedule/cancel via emailed token links, admin cancel
- **Email** — booking confirmations, owner notifications, and reminders (configurable lead time) via Resend
- **Theming** — light/dark/system with per-surface opt-in (admin pages, booking pages). Monochrome ink/paper design driven by CSS variables (`--ink`, `--paper`); dark mode inverts them. Booking pages follow the slot owner's preference — `system` resolves against the visitor's OS.

## Local development

Prereqs: Node 20+, Docker.

```sh
# 1. Postgres
docker-compose up -d

# 2. Backend (port 3002)
cd backend
cp .env.example .env   # fill in values — no quotes around values
npm install
npx prisma migrate dev
PORT=3002 npm run start:dev

# 3. Frontend (port 5173, proxies /api → 3002)
cd frontend
npm install
npm run dev
```

## Google OAuth setup

1. In Google Cloud Console, create OAuth 2.0 credentials and enable the Google Calendar API
2. Add authorized redirect URIs (local and production):
   - `http://localhost:3002/api/auth/google/callback`
   - `http://localhost:3002/api/auth/google/connect/callback`
   - `https://aen-scheduler.fly.dev/api/auth/google/callback`
   - `https://aen-scheduler.fly.dev/api/auth/google/connect/callback`
3. Copy the client ID and secret into `backend/.env` (unquoted — a stray `"` becomes part of the value and Google rejects the client)

The `connect` callback is used for linking additional Google accounts from the Calendars page.

## Environment variables (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials |
| `GOOGLE_CALLBACK_URL` | Login redirect URI |
| `GOOGLE_CONNECT_CALLBACK_URL` | Additional-account linking redirect URI |
| `JWT_SECRET` / `JWT_EXPIRY` | Session tokens |
| `FRONTEND_URL` | Used in OAuth redirects and email links |
| `RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_FROM_NAME` | Email sending |
| `PORT` / `NODE_ENV` | Server config (3002 locally, 3000 in the container) |

## Deployment

```sh
fly deploy --local-only   # local Docker build (remote builder can be flaky)
```

- The Dockerfile builds the frontend and serves it from the NestJS app (`/public`), with an SPA fallback; `index.html` is served `no-cache`, hashed assets immutable
- Prisma migrations run on boot (`prisma migrate deploy`)
- Secrets are managed with `fly secrets`; the Postgres app is `aen-scheduler-db`

## Custom domains

Point a CNAME at the Fly app hostname, add a certificate (`fly certs add <domain>`), then set the domain in Settings → Custom Domain. The app detects the hostname and routes `/` to the slot list and `/:slotSlug` to booking pages.
