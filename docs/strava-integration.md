# Strava Integration

Axis uses Strava API v3 with OAuth, webhooks, and a manual sync fallback.

---

## Authentication & Tokens

- OAuth starts at `GET /api/strava/connect`.
- Callback handling lives at `GET /api/strava/callback`.
- Required scopes: `activity:read_all,profile:read_all`.
- OAuth state is stored in the `strava_oauth_state` HTTP-only cookie for 10 minutes.
- Access and refresh tokens are stored on the authenticated user's `profiles` row.
- `getValidStravaToken()` refreshes tokens if they expire within five minutes.

Required environment variables:

```env
NEXT_PUBLIC_APP_URL
STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET
STRAVA_WEBHOOK_VERIFY_TOKEN
```

`STRAVA_WEBHOOK_SIGNING_SECRET` is optional and falls back to `STRAVA_CLIENT_SECRET`.

---

## Rate Limits

Strava's default application limits are currently:

- Overall: 200 requests per 15 minutes and 2,000 requests per day.
- Non-upload/read: 100 requests per 15 minutes and 1,000 requests per day.

Limits reset on natural 15-minute boundaries and at midnight UTC. See [Strava rate limits](https://developers.strava.com/docs/rate-limits/).

Axis keeps usage low by relying on webhooks and fetching streams only when a detail page needs them.

---

## Supported Strava Activity Types

`src/lib/strava/activity-row.ts` maps:

- Runs: `Run`, `VirtualRun` -> `activities.type = 'run'`
- Rides: `Ride`, `VirtualRide`, `EBikeRide`, `EMountainBikeRide`, `GravelRide`, `MountainBikeRide` -> `activities.type = 'ride'`

Other Strava sport types are not inserted as feed cardio activities. If an unsupported Strava activity overlaps a logged workout, Axis tries to merge biometric fields into the workout instead.

---

## API Wrapper

`src/lib/strava/client.ts` wraps direct `fetch()` calls:

| Helper | Endpoint | Used For |
|---|---|---|
| `getActivities` | `GET /athlete/activities` | Manual recent-activity sync |
| `getActivity` | `GET /activities/{id}` | Manual import and webhook processing |
| `getStreams` | `GET /activities/{id}/streams` | Activity detail stream charts |
| `getAthleteZones` | `GET /athlete/zones` | HR zone overlays |
| `getAthleteStats` | `GET /athletes/{id}/stats` | Available helper; not currently surfaced in UI |

---

## Webhooks

Route: `GET|POST /api/strava/webhook`

### Subscription Verification

The GET handler accepts Strava's `hub.mode`, `hub.verify_token`, and `hub.challenge` query parameters. It echoes `hub.challenge` when the verify token matches `STRAVA_WEBHOOK_VERIFY_TOKEN`.

### Event Handling

The POST handler:

1. Reads the raw request body.
2. Verifies the `X-Strava-Signature` header.
3. Parses the webhook payload.
4. Returns quickly with `{ "status": "ok" }`.
5. Uses `after()` to process the event asynchronously.

Processing behavior:

- Athlete deauthorization clears stored Strava tokens.
- Activity delete removes matching feed rows and pending workout links.
- Activity create/update fetches the full activity from Strava.
- Supported runs/rides upsert into `activities`.
- Unsupported activities are checked as possible workout biometric sources.

The callback must return `200 OK` within two seconds; Strava retries failed event deliveries.

### Signature Verification

The current verifier expects the modern Strava signature format:

```text
X-Strava-Signature: t=<unix_seconds>,v1=<hex_hmac>
```

It rejects missing/invalid signatures, timestamps outside a five-minute tolerance, and mismatched HMACs over:

```text
<timestamp>.<raw_body>
```

See [Strava webhook docs](https://developers.strava.com/docs/webhooks/).

---

## Manual Sync

Route: `GET|POST /api/strava/sync`

- `GET` fetches up to 50 Strava activities from the last 90 days, filters supported cardio types, and returns only activities not already imported.
- `POST` imports one selected activity by fetching full details and upserting the normalized row.

This is a fallback path for missed webhook events or first-time setup.

---

## Activity Rows

`buildActivityRow()` stores Strava summary/detail fields as typed columns:

```text
name, start_time, duration, elapsed_time, distance, avg_pace,
avg_heartrate, max_heartrate, suffer_score, calories, elevation_gain,
avg_cadence, avg_watts, max_speed, average_temp,
summary_polyline, splits, best_efforts
```

GPS polyline, splits, and best efforts power activity detail views and running PR stats.

---

## Streams And Zones

Streams are fetched on demand from:

```text
GET /api/strava/streams/{strava_activity_id}
```

Requested keys:

```text
time, distance, altitude, heartrate, cadence, watts, velocity_smooth, grade_smooth
```

The response is zipped into chart-ready points and downsampled to 400 points. Missing streams are handled as unavailable data.

Heart-rate zones are fetched from:

```text
GET /api/strava/zones
```

Both read-only endpoints are eligible for service-worker data caching.

---

## Workout Biometric Linking

When a Strava activity is not a supported cardio feed type, the webhook attempts to merge workout biometrics:

1. Find workout candidates within 90 minutes of the Strava start time.
2. Prefer candidates with at least 10 minutes of overlap or 40% overlap of the shorter activity.
3. If exactly one candidate exists, copy `avg_heartrate`, `max_heartrate`, `calories`, `suffer_score`, and `strava_activity_id` onto the workout.
4. If multiple candidates exist, insert `pending_strava_links` for user resolution in Activity and send an opt-in pending-link notification.

Pending links can be resolved through `POST /api/strava/link-workout` or dismissed through `POST /api/strava/link-workout/dismiss`.
