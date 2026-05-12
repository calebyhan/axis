# Axis

Personal athletic dashboard PWA. Axis combines Strava-synced endurance activity, manual strength sessions, body weight tracking, weekly planning, and rule-based training insights.

---

## Stack

| Layer | Technology |
|---|---|
| App | Next.js App Router / React |
| Backend | Next.js API routes + Server Actions |
| Database / Auth | Supabase Postgres, Auth, and RLS |
| Strava Integration | Strava API v3 + webhooks |
| Charts | Recharts |
| Validation | Zod |
| Exercise search | Fuse.js |
| Offline support | Custom service worker + IndexedDB |

---

## Docs

- [Architecture](docs/architecture.md) — runtime model, data flow, auth, PWA behavior
- [Database](docs/database.md) — current schema, RLS, RPCs, derived data
- [Strava Integration](docs/strava-integration.md) — OAuth, webhooks, manual sync, workout linking
- [Screens](docs/screens.md) — current tab and route specs
- [Session Flow](docs/session-flow.md) — workout lifecycle, draft persistence, recent stats
- [Smart Features](docs/smart-features.md) — implemented rule-based intelligence and planned ideas
- [Schedule & Day Types](docs/schedule.md) — weekly schedule, overrides, adherence snapshots
- [Design System](docs/design-system.md) — tokens, layout rules, muscle heatmap

---

## Quick Start

See [CONTRIBUTING.md](CONTRIBUTING.md) for local dev setup.
