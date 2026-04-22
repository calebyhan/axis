"use client";

import { useState } from "react";
import { LogRunForm } from "@/components/log/LogRunForm";
import { LogWeightForm } from "@/components/log/LogWeightForm";
import { SessionFlow } from "@/components/session/SessionFlow";

type Panel = null | "session" | "run" | "weight";

export default function LogPage() {
  const [panel, setPanel] = useState<Panel>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function onSaved(msg: string) {
    setSaved(msg);
    setPanel(null);
    setTimeout(() => setSaved(null), 3000);
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Capture</div>
          <h1 className="page-title">Log</h1>
          <p className="page-subtitle">Fast, thumb-friendly inputs for workouts, runs, and daily body weight.</p>
        </div>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-3 bg-green-900/20 border border-green-400/20 rounded-2xl text-sm text-green-300 backdrop-blur-xl">
          {saved}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={() => setPanel("session")}
          className="w-full card surface-hover p-5 text-left flex items-center justify-between"
        >
          <div>
            <div className="font-medium text-base">Start Workout Session</div>
            <div className="text-sm text-muted mt-1">Log sets, track progress, and keep the flow moving.</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-white/45 shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button
          onClick={() => setPanel("run")}
          className="w-full card surface-hover p-5 text-left flex items-center justify-between"
        >
          <div>
            <div className="font-medium text-base">Log Run</div>
            <div className="text-sm text-muted mt-1">Manual entry for distance, time, and perceived effort.</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-white/45 shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button
          onClick={() => setPanel("weight")}
          className="w-full card surface-hover p-5 text-left flex items-center justify-between"
        >
          <div>
            <div className="font-medium text-base">Log Body Weight</div>
            <div className="text-sm text-muted mt-1">Add a quick daily weigh-in without leaving the flow.</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-white/45 shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {panel === "session" && (
        <SessionFlow onClose={() => setPanel(null)} onComplete={() => onSaved("Session saved!")} />
      )}

      {(panel === "run" || panel === "weight") && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-50 flex items-end">
          <div className="w-full max-w-2xl mx-auto card rounded-b-none rounded-t-[2rem] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">
                {panel === "run" ? "Log Run" : "Log Body Weight"}
              </h2>
              <button onClick={() => setPanel(null)} className="text-white/55 text-sm">
                Cancel
              </button>
            </div>
            {panel === "run" ? (
              <LogRunForm onSave={() => onSaved("Run saved!")} />
            ) : (
              <LogWeightForm onSave={() => onSaved("Weight logged!")} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
