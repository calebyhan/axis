import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";

type PushSubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type SubscribeRequest = {
  subscription?: PushSubscriptionPayload;
  timezone?: string;
  userAgent?: string;
};

function validSubscription(subscription: PushSubscriptionPayload | undefined): subscription is Required<PushSubscriptionPayload> & {
  keys: { p256dh: string; auth: string };
} {
  return !!subscription?.endpoint && !!subscription.keys?.p256dh && !!subscription.keys?.auth;
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SubscribeRequest | null;
  if (!validSubscription(body?.subscription)) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const timezone = body?.timezone || "UTC";
  const userAgent = body?.userAgent?.slice(0, 500) ?? null;
  const { endpoint, keys } = body.subscription;

  const { error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (subscriptionError) {
    console.error("[notifications] subscription save failed", subscriptionError.message);
    return NextResponse.json({ error: "Subscription save failed" }, { status: 500 });
  }

  const { error: prefError } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        enabled: true,
        timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (prefError) {
    console.error("[notifications] preference enable failed", prefError.message);
    return NextResponse.json({ error: "Preference save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  let deleteQuery = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (body?.endpoint) deleteQuery = deleteQuery.eq("endpoint", body.endpoint);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    console.error("[notifications] subscription delete failed", deleteError.message);
    return NextResponse.json({ error: "Subscription delete failed" }, { status: 500 });
  }

  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) === 0) {
    await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          enabled: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
  }

  return NextResponse.json({ ok: true });
}
