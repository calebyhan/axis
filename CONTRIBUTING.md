# Running Axis Locally

## Prerequisites

- Node.js matching `package.json`: `>=22.13.0 <23` or `>=24`
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A [Supabase project](https://supabase.com/dashboard)
- [ngrok](https://ngrok.com/) for local Strava webhook testing
- A Strava API app from [strava.com/settings/api](https://www.strava.com/settings/api)

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd axis
npm install
```

---

## 2. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-key

STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_WEBHOOK_VERIFY_TOKEN=a-random-string-you-choose

# Optional. Defaults to STRAVA_CLIENT_SECRET if omitted.
STRAVA_WEBHOOK_SIGNING_SECRET=your-strava-webhook-signing-secret
```

Never commit `.env.local`. It is already ignored.

For local Strava OAuth callbacks, set the Strava app's authorization callback domain to your current public domain when using ngrok, or to `localhost` for local-only OAuth testing.

---

## 3. Supabase Setup

Link the CLI to your Supabase project, then push the schema:

```bash
supabase login
supabase link --project-ref <ref>
supabase db push
```

Find `<ref>` in Supabase under **Settings -> General -> Reference ID**.

---

## 4. Seed Exercises

On first setup, seed the exercise taxonomy:

```bash
npm run seed:exercises
```

The seed script uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` from `.env.local`.

---

## 5. Run Dev Server

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

---

## 6. Strava Webhook for Local Development

Strava webhooks require a public HTTPS callback. Start ngrok:

```bash
ngrok http 3000
```

Set `NEXT_PUBLIC_APP_URL` to the `https://` forwarding URL while testing Strava OAuth/webhooks locally, then restart the dev server.

Register a webhook subscription:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID \
  -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://<your-ngrok-id>.ngrok.io/api/strava/webhook \
  -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
```

Strava allows one webhook subscription per app. Delete the old subscription before re-registering if your ngrok URL changes.

---

## Useful Commands

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
```
