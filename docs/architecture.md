# Architecture

## Model

Axis uses an **aggregator-dashboard model** — hardware sends data to Strava, Strava pushes to Supabase, Next.js reads from Supabase.

```
Hardware (Watch / Device)
        ↓
    Strava App
        ↓  (OAuth 2.0 + Webhooks)
  Supabase Edge Function  ←→  Strava API v3
        ↓
  Supabase (PostgreSQL + RLS)
        ↓
  Next.js / React PWA
```

No polling. Strava webhooks push new activities automatically. The frontend never touches Strava tokens.

---

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js / React | PWA capabilities, routing, UI |
| Backend / Database | Supabase (PostgreSQL + RLS + Edge Functions) | Auth, storage, webhooks, token management |
| Strava Integration | Strava API v3 + Webhooks | Automated activity ingestion |
| Visualizations | Recharts | Charts, trends, effort metrics |
| Data Validation | Zod | Consistency across manual and automated inputs |
| Strava SDK | `strava-v3` | API request construction and typing |
| Fuzzy Search | `fuse.js` | Client-side exercise name matching |

Token refresh and webhook HMAC verification are implemented in Edge Functions, not in `strava-v3` itself.

---

## PWA Specifications

- **Offline persistence** via Workbox / Service Workers + IndexedDB local cache
- **Session draft autosave** to IndexedDB every 60 seconds (crash recovery)
- **Mobile:** thumb-optimized bottom tab navigation
- **Desktop:** 240px left sidebar navigation
- **Installable** via `manifest.json` on iOS Safari and Desktop Chrome/Safari
- **Deep linking** — workout and activity views are bookmarkable by the logged-in user (auth required; links are not publicly shareable)

### iOS PWA Limitations

Push notifications and background sync are not available in iOS Safari PWAs. Week in Review and any alert-style notifications are displayed in-app only, not as system notifications.

---

## Navigation Structure

Five tabs, each with a single clear responsibility:

| Tab | Purpose |
|---|---|
| **Dashboard** | At-a-glance weekly overview, streak, checklist |
| **Activity** | Full history feed — runs and workouts |
| **Log** | All manual input — sessions, runs, body weight |
| **Stats** | All charts and trends — filtered by time range |
| **Settings** | Strava connection, units, schedule, preferences |

**Mobile:** bottom tab bar with icons.  
**Desktop:** 240px left sidebar with the same items vertically.

---

## Key Design Constraints

- **Single user** — no multi-tenancy, no social features
- **No HealthKit dependency** — avoids native iOS development and Apple Developer Program costs
- **No LLM APIs** — all smart features are rule-based SQL + client-side JavaScript; zero recurring AI cost
- **Strava-only automated ingestion** — Strava bridges Apple HealthKit natively, solving hardware data without custom device integration
- **Minimal manual input** — only strength sessions and body weight require manual entry
