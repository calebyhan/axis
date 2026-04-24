import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStreams } from "@/lib/strava/client";

const STREAM_KEYS = ["time", "distance", "altitude", "heartrate", "cadence", "watts", "velocity_smooth", "grade_smooth"];

// Downsample an array to at most maxPoints by taking every nth element.
function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const n = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % n === 0);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stravaId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: Record<string, { data: number[] }>;
  try {
    raw = await getStreams(user.id, Number(stravaId), STREAM_KEYS);
  } catch {
    return NextResponse.json({ error: "Failed to fetch streams" }, { status: 502 });
  }

  const time: number[] = raw.time?.data ?? [];
  if (time.length === 0) return NextResponse.json({ points: [], available: [] });

  const available: string[] = STREAM_KEYS.filter(
    (k) => k !== "time" && raw[k]?.data?.length === time.length
  );

  // Zip into chart-ready array of objects, then downsample
  type Point = { t: number; [key: string]: number | null };
  const zipped: Point[] = time.map((t, i) => {
    const point: Point = { t };
    for (const key of available) {
      point[key] = raw[key].data[i] ?? null;
    }
    return point;
  });

  const points = downsample(zipped, 400);

  return NextResponse.json({ points, available });
}
