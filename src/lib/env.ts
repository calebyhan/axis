export function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
}

export function getSupabasePublishableKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return value;
}

export function getSupabaseSecretKey() {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new Error("Missing required environment variable: SUPABASE_SECRET_KEY");
  }
  return value;
}

export function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL");
  }
  return value;
}

export function getStravaClientId() {
  const value = process.env.STRAVA_CLIENT_ID;
  if (!value) {
    throw new Error("Missing required environment variable: STRAVA_CLIENT_ID");
  }
  return value;
}

export function getStravaClientSecret() {
  const value = process.env.STRAVA_CLIENT_SECRET;
  if (!value) {
    throw new Error("Missing required environment variable: STRAVA_CLIENT_SECRET");
  }
  return value;
}

export function getStravaWebhookVerifyToken() {
  const value = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  if (!value) {
    throw new Error("Missing required environment variable: STRAVA_WEBHOOK_VERIFY_TOKEN");
  }
  return value;
}
