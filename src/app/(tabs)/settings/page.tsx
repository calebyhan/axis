export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: schedule }, { data: dayTypes }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("weekly_schedule")
      .select("*")
      .eq("user_id", user.id)
      .order("day_of_week"),
    supabase.from("day_types").select("*").order("name"),
  ]);

  const stravaConnected = !!profile?.strava_access_token;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>
      <SettingsClient
        profile={profile}
        schedule={schedule ?? []}
        dayTypes={dayTypes ?? []}
        stravaConnected={stravaConnected}
      />
    </div>
  );
}
