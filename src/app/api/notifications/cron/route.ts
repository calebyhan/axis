import { NextRequest, NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { runScheduledNotifications } from "@/lib/notifications/scheduled";

export const runtime = "nodejs";

function authorized(request: NextRequest): boolean {
  const secret = getCronSecret();
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScheduledNotifications();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
