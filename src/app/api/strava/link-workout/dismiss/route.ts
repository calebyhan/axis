import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseUrl, getSupabaseSecretKey } from "@/lib/env";

export async function POST(request: NextRequest) {
  const { pendingLinkId } = await request.json();
  if (!pendingLinkId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll() {},
    },
  });

  await supabase.from("pending_strava_links").delete().eq("id", pendingLinkId);
  return NextResponse.json({ ok: true });
}
