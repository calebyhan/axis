# Running Axis Locally

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [ngrok](https://ngrok.com/) (for Strava webhook dev)
- A Strava API app — create one at [strava.com/settings/api](https://www.strava.com/settings/api)

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
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_WEBHOOK_VERIFY_TOKEN=a-random-string-you-choose
```

Never commit `.env.local`. It is already in `.gitignore`.

---

## 3. Supabase Local Dev

```bash
supabase start          # starts local Postgres + Edge Functions
supabase db push        # applies migrations to local DB
```

Local Supabase Studio is at `http://localhost:54323`.

---

## 4. Strava Webhook (local)

Strava webhooks require a public HTTPS URL. Use ngrok:

```bash
ngrok http 3000
```

Copy the `https://` forwarding URL. Register your webhook subscription:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID \
  -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://<your-ngrok-id>.ngrok.io/api/strava/webhook \
  -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
```

One subscription per Strava app — delete the existing one before re-registering if ngrok restarts.

---

## 5. Run Dev Server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

---

## 6. Exercise Taxonomy Seed

On first run, seed the exercise database from the Wger open dataset:

```bash
npm run seed:exercises
```

This is a one-time operation. It populates the `exercises` table with muscle mappings that power the smart feature layer.
