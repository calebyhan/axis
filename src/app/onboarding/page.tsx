export const dynamic = "force-dynamic";
export const metadata = { title: "Setup - Axis", description: "Finish setting up Axis" };

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingClient } from "@/components/onboarding/OnboardingClient";
import { isAccentColor } from "@/lib/accent-colors";
import type { AccentColor } from "@/types";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, accent_color, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    redirect(nextPath);
  }

  const initialAccent = getInitialAccent(profile?.accent_color);
  const initialDisplayName = profile?.display_name?.trim() || getDefaultDisplayName(user);

  return (
    <OnboardingClient
      initialDisplayName={initialDisplayName}
      initialAccent={initialAccent}
      nextPath={nextPath}
    />
  );
}

function sanitizeNextPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/auth/callback") || raw.startsWith("/onboarding")) {
    return "/dashboard";
  }
  return raw;
}

function getInitialAccent(raw: string | null | undefined): AccentColor {
  return raw && isAccentColor(raw) ? raw : "blue";
}

function getDefaultDisplayName(user: { email?: string; user_metadata?: Record<string, unknown> }): string {
  const metadata = user.user_metadata ?? {};
  const rawName =
    metadata.given_name ??
    metadata.full_name ??
    metadata.name ??
    metadata.preferred_username;

  if (typeof rawName === "string" && rawName.trim()) {
    return rawName.trim().split(" ")[0];
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "";
}
