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
      .select("*, day_type:day_types(*)")
      .order("day_of_week"),
    supabase.from("day_types").select("*").order("name"),
  ]);

  const stravaConnected = !!profile?.strava_access_token;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>
      <SettingsClient
        profile={profile}
        schedule={schedule ?? []}
        dayTypes={dayTypes ?? []}
        stravaConnected={stravaConnected}
      />
    </div>
  );
}
