"use client";

import { useState } from "react";
import { deleteActivity } from "@/app/(tabs)/activity/actions";

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    await deleteActivity(activityId);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-white/45 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/45 hover:text-red-400 hover:border-red-400/30 transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  );
}
