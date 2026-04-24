# Axis

Personal athletic dashboard PWA. Unifies endurance data (Strava) and strength training on a single timeline with a single load model.

**Strava is the sensor layer. Axis is the intelligence layer.**

No existing app combines Strava-automated run ingestion with manual strength logging, cross-discipline load tracking (ATL/CTL), and rule-based insights — all without LLM APIs or recurring AI costs.

Single user. Own your data. No social features, no SaaS, no app review required.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js / React (PWA) |
| Backend / Database | Supabase (PostgreSQL + RLS + Edge Functions) |
| Strava Integration | Strava API v3 + Webhooks via `strava-v3` |
| Charts | Recharts |
| Validation | Zod |
| Exercise search | Fuse.js (client-side) |

---

## Docs

- [Architecture](docs/architecture.md) — stack, data flow, PWA specs
- [Database](docs/database.md) — schema, RLS, derived data
- [Strava Integration](docs/strava-integration.md) — OAuth, webhooks, linking flow
- [Screens](docs/screens.md) — all five tab specs
- [Session Flow](docs/session-flow.md) — workout lifecycle, state shape, recent stats panel
- [Smart Features](docs/smart-features.md) — rule-based intelligence (pre/mid/post/weekly)
- [Schedule & Day Types](docs/schedule.md) — weekly schedule, checklist matching algorithm
- [Design System](docs/design-system.md) — visual tokens, muscle heatmap

---

## Quick Start

See [CONTRIBUTING.md](CONTRIBUTING.md) for local dev setup.

## Deploying To Vercel

Axis is a standard Next.js app and can be deployed directly on Vercel.

### Environment Variables

Add these variables in the Vercel project settings for every production environment:

- `NEXT_PUBLIC_APP_URL=https://your-project.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...`
- `SUPABASE_SECRET_KEY=...`
- `STRAVA_CLIENT_ID=...`
- `STRAVA_CLIENT_SECRET=...`
- `STRAVA_WEBHOOK_VERIFY_TOKEN=...`

You can use [.env.local.example](.env.local.example) as the source of truth for required keys.

### Strava Production Setup

After the first Vercel deploy, update the Strava app configuration to use your production URLs:

- Authorization Callback Domain: your deployed Vercel domain
- OAuth redirect URI: `https://your-project.vercel.app/api/strava/callback`
- Webhook callback URL: `https://your-project.vercel.app/api/strava/webhook`
- Webhook verify token: match `STRAVA_WEBHOOK_VERIFY_TOKEN`

If you use a custom domain, use that instead of the default `vercel.app` hostname and set `NEXT_PUBLIC_APP_URL` to the same origin.

### Notes

- The Strava routes are pinned to the Node.js runtime for Vercel compatibility.
- The webhook uses Next.js `after()` so post-response activity imports keep working on serverless infrastructure.
- Missing required environment variables now fail fast with explicit errors instead of vague runtime crashes.
