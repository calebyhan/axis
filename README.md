# Axis

Personal athletic dashboard PWA. Unifies endurance data (Strava) and strength training on a single timeline with a single load model.

**Strava is the sensor layer. Axis is the intelligence layer.**

No existing app combines Strava-automated run ingestion with manual strength logging, cross-discipline load tracking (ATL/CTL), and rule-based insights - all without LLM APIs or recurring AI costs.

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
