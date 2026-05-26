"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIME_ZONE_COOKIE } from "@/lib/time-zone";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function currentCookieValue(name: string): string | null {
  const prefix = `${name}=`;
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

export function TimeZoneSync() {
  const { refresh } = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;

    const encoded = encodeURIComponent(timeZone);
    const existing = currentCookieValue(TIME_ZONE_COOKIE);
    document.cookie = [
      `${TIME_ZONE_COOKIE}=${encoded}`,
      "path=/",
      `max-age=${ONE_YEAR_SECONDS}`,
      "samesite=lax",
    ].join("; ");

    if (existing !== encoded) {
      refresh();
    }
  }, [refresh]);

  return null;
}
