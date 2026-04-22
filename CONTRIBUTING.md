# Running Axis Locally

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A [Supabase project](https://supabase.com/dashboard) (free tier is fine)
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
# Supabase — get both from your project's Connect dialog or Settings → API Keys
# Publishable key starts with sb_publishable_ (replaces legacy anon key)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Secret key starts with sb_secret_ — server/Edge Functions only, never expose to browser
# Settings → API Keys → Create new API Keys → Secret key
SUPABASE_SECRET_KEY=your-supabase-secret-key

STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
STRAVA_WEBHOOK_VERIFY_TOKEN=a-random-string-you-choose
```

Never commit `.env.local`. It is already in `.gitignore`.

---

## 3. Supabase Setup

Link the CLI to your online Supabase project, then push the schema:

```bash
supabase login                      # authenticate with your Supabase account
supabase link --project-ref <ref>   # project ref is in Settings → General
supabase db push                    # applies migrations to the remote DB
```

Find `<ref>` in your Supabase dashboard under **Settings → General → Reference ID**.
Studio is available at `https://supabase.com/dashboard/project/<ref>`.

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
