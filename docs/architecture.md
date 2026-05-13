# Architecture

## Runtime Model

Axis is a Next.js PWA backed by Supabase. Strava pushes webhook events into a Next.js API route; the route fetches the current activity from Strava, then writes normalized rows into Supabase.

```
Watch / device
        ↓
     Strava
        ↓ OAuth + webhook
Next.js API routes / Server Actions
        ↓
Supabase Auth + Postgres + RLS
        ↓
Next.js / React PWA
```

The app avoids polling for normal sync. A manual sync endpoint exists as a fallback for recent Strava activities.

---

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| App | Next.js App Router / React | Routing, UI, server components |
| Backend | API routes + Server Actions | Strava OAuth/webhooks, mutations, cache revalidation |
| Database/Auth | Supabase Postgres, Auth, RLS | User rows, activity storage, auth session handling |
| Strava API | Direct `fetch` wrapper in `src/lib/strava` | Token refresh, activity fetches, streams, zones |
| Charts | Recharts | Stats and training load visualizations |
| Validation | Server-side guards + Zod dependency | Manual input and API payload consistency |
| Exercise search | Fuse.js | Client-side exercise filtering |
| Offline | Custom service worker + IndexedDB | Page/data caching and workout draft recovery |

---

## Auth And Routing

- Supabase Auth handles login and session cookies.
- `src/proxy.ts` protects app routes and allows `/login`, `/auth/callback`, and `/api/strava/webhook`.
- Server components and server actions use `@supabase/ssr`.
- Admin-only operations use `SUPABASE_SECRET_KEY` through `createAdminClient()`.

---

## PWA Behavior

- `public/manifest.json` makes the app installable.
- `public/sw.js` is registered only in production.
- The service worker cache-firsts static assets, network-firsts pages, caches read-only Strava stream/zone API responses, and handles push notification display/clicks.
- Workout session drafts are stored in IndexedDB (`axis/session_drafts`) and can be cleared from Settings.
- Mobile layouts reserve bottom-nav and safe-area space; desktop uses a left sidebar.

### Push Notifications

Web Push is opt-in from Settings and stores subscriptions in `push_subscriptions`.
Notification preferences live in `notification_preferences`.

Implemented notification types:

- Today's plan reminder.
- Pending Strava workout-link resolution.
- Same-day pending plan nudge.
- Weekly review.

Scheduled notifications are produced by `GET /api/notifications/cron`, which is intended to run through Vercel Cron using `CRON_SECRET`.
On iOS/iPadOS, Web Push requires the PWA to be added to the Home Screen.
Generate VAPID keys with `npx web-push generate-vapid-keys` and set `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` plus `WEB_PUSH_PRIVATE_KEY`.

---

## Navigation Structure

| Route | Purpose |
|---|---|
| `/dashboard` | Weekly overview, streak, checklist, muscle coverage, body weight |
| `/activity` | Feed of runs, rides, manual runs, and workouts |
| `/activity/[id]` | Activity detail, editable workouts, run streams |
| `/log` | Workout session flow, manual run, body weight |
| `/stats` | Workout, running, body, load, and plan tabs |
| `/settings` | Profile, units, schedule, Strava, export, offline cache |

---

## Constraints

- Single-user product shape; RLS still scopes every user-owned table by `auth.uid()`.
- No HealthKit dependency; Strava bridges supported devices.
- No LLM APIs; insights are rule-based SQL and TypeScript.
- Strava tokens are currently stored on `profiles`; server routes use them for Strava API requests.
