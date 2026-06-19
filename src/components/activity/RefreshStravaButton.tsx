"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshStravaButton({ stravaActivityId }: { stravaActivityId: number }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleRefresh() {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityId: stravaActivityId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Refresh failed");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        aria-label="Refresh from Strava"
        onClick={handleRefresh}
        disabled={pending}
        className="shrink-0 size-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          className={`size-4 ${pending ? "animate-spin" : ""}`}
        >
          <path d="M1 4v6h6" />
          <path d="M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
        </svg>
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
