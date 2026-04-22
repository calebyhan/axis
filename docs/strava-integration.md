# Strava Integration

Axis uses Strava API v3 with a webhook-first architecture — no polling ever.

---

## Authentication & Tokens

- OAuth 2.0 flow — access tokens expire every **6 hours**
- Tokens stored in Supabase via the **Vault extension** (`vault.secrets`); the frontend never touches tokens directly
- Silent token refresh handled by Supabase Edge Functions before every Strava API call
- Required scopes: `activity:read_all`, `profile:read_all`
- Personal tool — **no app review required**; token accessible directly from `strava.com/settings/api`

---

## Rate Limits

- **200 requests per 15 minutes**, up to **2,000 per day**
- Webhook-first architecture eliminates polling; effective request rate is very low for a single user

---

## Key Endpoints

| Endpoint | Returns | When Used |
|---|---|---|
| `GET /athlete/activities` | Paginated activity list with summary fields | Initial sync, Activity feed |
| `GET /activities/{id}` | Full activity detail | Detailed activity view |
| `GET /activities/{id}/streams` | Raw time-series data | On-demand when linking a Strava activity to a strength session |
| `GET /athlete/zones` | Configured HR zones | Zone breakdown on Stats screen |
| `GET /athletes/{id}/stats` | Lifetime + YTD totals | Stats screen aggregates |

### Activity Summary Fields

Available on every synced activity with no extra API calls:

`distance`, `moving_time`, `elapsed_time`, `average_heartrate`, `max_heartrate`, `total_elevation_gain`, `calories`, `suffer_score`, `sport_type`, `start_date`, `start_date_local`, `pr_count`, `device_name`

These are stored as typed columns on the `activities` table (not in the JSONB blob) to enable efficient sorting and filtering.

### Activity Streams

Raw time-series data fetched **on demand only** — never pre-fetched for all activities.

Available types: `time`, `latlng`, `distance`, `altitude`, `velocity_smooth`, `heartrate`, `cadence`, `watts`, `temp`, `moving`, `grade_smooth`

**Cost:** 2 API calls per activity. Only fetched when user explicitly links a Strava activity to a strength session.

**Caveat:** streams only exist if the data was recorded — no HR stream without an HR monitor. Handle missing data gracefully; never throw on absent streams.

---

## Webhooks

Push model — Strava POSTs to Axis immediately after any activity is saved.

### Flow

1. Workout saved in Strava
2. Strava POSTs to Supabase Edge Function webhook URL
3. Payload contains `object_type`, `aspect_type: "create"`, and `object_id`
4. Edge Function verifies `X-Hub-Signature` (see Security below)
5. Edge Function fetches activity summary via `GET /activities/{id}`
6. Writes to `activities` table
7. Activity appears in Axis feed automatically

### Requirements

- HTTPS in production (ngrok for local dev — see [CONTRIBUTING.md](../CONTRIBUTING.md))
- Respond with `200 OK` within 2 seconds — minimal handler work, async queue for DB write
- One webhook subscription per Strava app

### Security

Verify the `X-Hub-Signature` header on every incoming POST using HMAC-SHA256 with your `STRAVA_CLIENT_SECRET`. Reject any request that fails verification before processing the payload.

```typescript
import { createHmac } from 'crypto'

function verifyStravaWebhook(body: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  return expected === signature
}
```

---

## Session-to-Strava Linking Flow

Links a strength session to a concurrent Strava activity to merge HR stream data.

1. Axis stores `session_start_time` when "Start Session" is tapped
2. At session end, user taps "Link Strava Activity"
3. Axis calls `GET /athlete/activities?after={start}&before={end}`
4. Surfaces the most likely candidate activity
5. User confirms
6. Axis fetches HR stream (`GET /activities/{id}/streams?keys=heartrate`) and merges into the session record in Supabase

---

## SDK

Uses `strava-v3` npm package for API request construction and response typing. Token refresh and webhook signature verification are implemented in Edge Functions directly, not delegated to the SDK.
