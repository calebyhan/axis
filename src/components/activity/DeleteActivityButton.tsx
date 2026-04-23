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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">Delete this activity?</span>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-muted hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-muted hover:text-red-400 transition-colors"
    >
      Delete
    </button>
  );
}
