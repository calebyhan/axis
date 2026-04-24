import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAthleteZones } from "@/lib/strava/client";

export interface HRZone {
  min: number;
  max: number; // -1 means no upper bound; callers should treat as 220
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ hr: null }, { status: 401 });

  try {
    const data = await getAthleteZones(user.id);
    const zones: HRZone[] = data?.heart_rate?.zones ?? [];
    return NextResponse.json({ hr: zones.length ? zones : null });
  } catch {
    return NextResponse.json({ hr: null });
  }
}
