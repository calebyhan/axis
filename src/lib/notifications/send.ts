import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import { getWebPushPrivateKey, getWebPushPublicKey, getWebPushSubject } from "@/lib/env";
import type { NotificationPreferences } from "@/types";

export type NotificationKind =
  | "today_plan"
  | "pending_strava_link"
  | "plan_nudge"
  | "weekly_review";

export interface AxisNotification {
  kind: NotificationKind;
  dedupeKey: string;
  title: string;
  body: string;
  url: string;
}

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotificationEventRow = {
  id: string;
  sent_at: string | null;
};

const KIND_PREF_KEYS: Record<NotificationKind, keyof NotificationPreferences> = {
  today_plan: "today_plan_enabled",
  pending_strava_link: "pending_strava_enabled",
  plan_nudge: "plan_nudge_enabled",
  weekly_review: "weekly_review_enabled",
};

let webPushConfigured = false;

function configureWebPush(): boolean {
  const publicKey = getWebPushPublicKey();
  const privateKey = getWebPushPrivateKey();

  if (!publicKey || !privateKey) return false;
  if (!webPushConfigured) {
    webpush.setVapidDetails(getWebPushSubject(), publicKey, privateKey);
    webPushConfigured = true;
  }
  return true;
}

function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function notificationPayload(notification: AxisNotification) {
  return JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url,
    tag: `${notification.kind}:${notification.dedupeKey}`,
    icon: "/icons/icon-192.svg",
    badge: "/icons/icon-192.svg",
    timestamp: Date.now(),
  });
}

export async function sendNotificationToUser(
  userId: string,
  notification: AxisNotification
): Promise<{ sent: number; skipped: string | null }> {
  if (!configureWebPush()) {
    console.warn("[notifications] Web Push is not configured; skipping send.");
    return { sent: 0, skipped: "not_configured" };
  }

  const supabase = createAdminClient();

  const [{ data: prefs, error: prefsError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId),
  ]);

  if (prefsError) {
    console.error("[notifications] Preference lookup failed", prefsError.message);
    return { sent: 0, skipped: "preference_error" };
  }
  if (subscriptionsError) {
    console.error("[notifications] Subscription lookup failed", subscriptionsError.message);
    return { sent: 0, skipped: "subscription_error" };
  }

  const typedPrefs = prefs as NotificationPreferences | null;
  if (!typedPrefs?.enabled || !typedPrefs[KIND_PREF_KEYS[notification.kind]]) {
    return { sent: 0, skipped: "disabled" };
  }

  const rows = (subscriptions ?? []) as PushSubscriptionRow[];
  if (rows.length === 0) return { sent: 0, skipped: "no_subscriptions" };

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("notification_events")
    .select("id, sent_at")
    .eq("user_id", userId)
    .eq("kind", notification.kind)
    .eq("dedupe_key", notification.dedupeKey)
    .maybeSingle();

  if (existingEventError) {
    console.error("[notifications] Event lookup failed", existingEventError.message);
    return { sent: 0, skipped: "event_error" };
  }

  const priorEvent = existingEvent as NotificationEventRow | null;
  if (priorEvent?.sent_at) return { sent: 0, skipped: "duplicate" };

  const payload = notificationPayload(notification);
  let sent = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(toPushSubscription(row), payload);
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
          return;
        }
        console.error("[notifications] Push send failed", {
          subscriptionId: row.id,
          statusCode,
          error: String(err),
        });
      }
    })
  );

  if (sent > 0) {
    const sentAt = new Date().toISOString();
    if (priorEvent?.id) {
      await supabase
        .from("notification_events")
        .update({
          title: notification.title,
          body: notification.body,
          url: notification.url,
          sent_at: sentAt,
        })
        .eq("id", priorEvent.id);
    } else {
      const { error: eventError } = await supabase
        .from("notification_events")
        .insert({
          user_id: userId,
          kind: notification.kind,
          dedupe_key: notification.dedupeKey,
          title: notification.title,
          body: notification.body,
          url: notification.url,
          sent_at: sentAt,
        });
      if (eventError && eventError.code !== "23505") {
        console.error("[notifications] Event insert failed", eventError.message);
      }
    }
  }

  return { sent, skipped: sent > 0 ? null : "send_failed" };
}
