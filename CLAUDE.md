# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AEN Scheduler — a personal Calendly alternative. Visitors book time on a public page; events land in the owner's Google Calendar with conflict checking, buffers, and email notifications. Single-owner-per-deployment in practice, but the data model is multi-user (keyed by `User`).

## Repository layout

Two independent apps, no root build orchestration (the root `package-lock.json` is a stub):

- `backend/` — NestJS 10/11 + Prisma + PostgreSQL, serves the JSON API under `/api`
- `frontend/` — React 18 + Vite + Tailwind, an SPA (admin dashboard + public booking pages)

In production both are one container: the frontend is built into the backend's `public/` and served by NestJS with an SPA fallback (see `backend/src/main.ts`).

## Commands

Run these from inside `backend/` or `frontend/` respectively — there is no root-level task runner.

```sh
# Postgres (+ unused redis) for local dev
docker-compose up -d

# Backend — MUST set PORT=3002 locally (see gotcha below)
cd backend
npm install
npx prisma migrate dev            # apply/create migrations against local DB
PORT=3002 npm run start:dev       # watch mode
npm run build                     # nest build → dist/
npx prisma studio                 # inspect the DB

# Frontend — Vite on :5173, proxies /api → localhost:3002
cd frontend
npm install
npm run dev
npm run build                     # tsc typecheck + vite build → dist/
```

There is **no test suite and no lint config** in either app. "Verifying a change" means `npm run build` (which typechecks) plus manually exercising the flow. Do not invent test commands.

Deploy is Fly.io: `fly deploy --local-only` (remote builder is flaky). Migrations run on boot via the container `CMD` (`prisma migrate deploy`). Secrets via `fly secrets`; DB app is `aen-scheduler-db`.

## Backend architecture

Standard NestJS module-per-domain layout wired in `app.module.ts`. Global `ThrottlerGuard` (30 req/min), global `ValidationPipe` (whitelist + transform). The important cross-cutting logic:

- **`availability/availability.service.ts` is the core engine.** `getAvailableSlots` composes free/busy from *all* connected Google accounts, existing bookings (padded by the slot type's `bufferBefore`/`bufferAfter`), recurring breaks, holidays, working hours, and active slot locks into a single busy set, then emits candidate slots on a **fixed 30-minute grid** (not stepped by duration) clamped to `minAdvanceHours`/`maxAdvanceDays`. All arithmetic is timezone-aware via `date-fns-tz`: **working hours/breaks/holidays are evaluated in the owner's `user.timezone`**, slots are returned as ISO UTC. Touch this file carefully — off-by-one timezone bugs hide here.

- **Double-booking prevention is two-layered.** During the attendee's flow the frontend takes a 5-minute `SlotLock` (`lockSlot`/`releaseLock`); locks are cleaned lazily on read. At commit time `bookings.service.create` *re-checks* DB conflicts, per-day caps, and live Google free/busy before inserting, then releases the lock. Never rely on the lock alone.

- **Multi-account Google Calendar** (`calendars/calendars.service.ts`). A `User` has many `GoogleAccount`s: the primary comes from login, others via the "connect" OAuth flow. Each `ConnectedCalendar` belongs to a `GoogleAccount`. OAuth clients are built per-account and **auto-persist refreshed tokens** via the `oauth2Client.on('tokens', …)` listener — this is load-bearing (a prior bug was silent expiry). Any new Google API call must go through `getOAuthClient`/`getOAuthClientForCalendar` so refresh + persistence happen.

- **Booking is resilient to calendar failure.** If `createEvent` throws, the booking is still saved (with `googleEventId` null) and a sync-failure alert email is sent to the owner. Don't make calendar success a hard precondition for the booking row.

- **Reschedule** (`bookings.service.reschedule`) creates a brand-new booking via `create()` (reusing all conflict logic), marks the old row `rescheduled`, and deletes the old Google event. Cancel/reschedule are gated to ≥48h before start and authorized by unguessable `cancelToken`/`rescheduleToken` (no auth needed for the attendee).

- **Reminders** (`reminders/reminders.service.ts`) — `@Cron` every 10 min, matches bookings in a `reminderHours ± 10min` window, `reminderSentAt` provides idempotency. Only fires for users with `sendReminders` on.

- **Auth** — Google OAuth via Passport. Two callback URIs with distinct purposes: `/api/auth/google/callback` (login) and `/api/auth/google/connect/callback` (linking an extra account). The connect flow carries the current `userId` across the OAuth round-trip in a short-lived JWT (`generateConnectToken`, 10-min expiry) since the redirect drops the session. API auth is a JWT bearer token (`JwtAuthGuard`).

## Frontend architecture

- **`App.tsx` routing branches on hostname.** `isCustomDomain()` compares `window.location.hostname` against `VITE_APP_HOST` (a Vite build arg). On the canonical host, admin lives under `/admin/*` and public booking under `/book/:slug/:slotSlug`. On a custom domain (e.g. `meet.aen.is`) the tree collapses so `/` is the slot list and `/:slotSlug` is a booking page. Backend resolves the owner from the domain via `slot-types/by-domain`.
- Auth token lives in `localStorage` as `auth_token`; the axios instance in `api/client.ts` attaches it and, on any 401, clears it and hard-redirects to `/login`. All API calls go through the typed helpers in that file.
- React Query for server state (30s stale time). `AuthContext` holds the user; `ThemeContext` is **surface-aware** (admin vs booking) — theme prefs are stored per-user and applied per-surface, so booking pages can follow the owner's choice while admin follows another. `ThemeSyncer` copies server prefs into local state **once per login** to avoid clobbering optimistic toggles.
- Theming is CSS-variable driven (`--ink`/`--paper`, inverted in dark mode).

## Gotchas

- **Local backend port is 3002**, but `main.ts` defaults to `3001` when `PORT` is unset. The Vite proxy and README assume 3002 — always `PORT=3002`. Production uses 3000.
- **`backend/.env` values must be unquoted.** A stray `"` becomes part of the value; Google rejects the OAuth client with quoted credentials.
- Adding an env-dependent redirect URI means also registering it in Google Cloud Console (login *and* connect callbacks, local *and* prod).
- Prisma uses string enums (e.g. `status`: `booked`/`cancelled`/`rescheduled`, `meetingLinkType`, `accessLevel`) rather than DB enums — validate values in code.
