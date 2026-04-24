function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl() {
  return getEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return getEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabaseSecretKey() {
  return getEnv("SUPABASE_SECRET_KEY");
}

export function getAppUrl() {
  return getEnv("NEXT_PUBLIC_APP_URL");
}

export function getStravaClientId() {
  return getEnv("STRAVA_CLIENT_ID");
}

export function getStravaClientSecret() {
  return getEnv("STRAVA_CLIENT_SECRET");
}

export function getStravaWebhookVerifyToken() {
  return getEnv("STRAVA_WEBHOOK_VERIFY_TOKEN");
}
