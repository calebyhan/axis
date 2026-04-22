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
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Log</h1>

      {saved && (
        <div className="mb-4 px-4 py-2.5 bg-green-900/30 border border-green-700/40 rounded-lg text-sm text-green-400">
          {saved}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={() => setPanel("session")}
          className="w-full card p-4 text-left hover:border-accent transition-colors flex items-center justify-between"
        >
          <div>
            <div className="font-medium">Start Workout Session</div>
            <div className="text-xs text-muted mt-0.5">Log sets, track progress, get suggestions</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-muted shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button
          onClick={() => setPanel("run")}
          className="w-full card p-4 text-left hover:border-[#1F1F1F] transition-colors flex items-center justify-between"
        >
          <div>
            <div className="font-medium">Log Run</div>
            <div className="text-xs text-muted mt-0.5">Manual entry — distance, time, effort</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-muted shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button
          onClick={() => setPanel("weight")}
          className="w-full card p-4 text-left hover:border-[#1F1F1F] transition-colors flex items-center justify-between"
        >
          <div>
            <div className="font-medium">Log Body Weight</div>
            <div className="text-xs text-muted mt-0.5">Daily weigh-in</div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-muted shrink-0">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      {panel === "session" && (
        <SessionFlow onClose={() => setPanel(null)} onComplete={() => onSaved("Session saved!")} />
      )}

      {(panel === "run" || panel === "weight") && (
        <div className="fixed inset-0 bg-background/80 z-50 flex items-end">
          <div className="w-full max-w-2xl mx-auto card rounded-b-none p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">
                {panel === "run" ? "Log Run" : "Log Body Weight"}
              </h2>
              <button onClick={() => setPanel(null)} className="text-muted text-sm">
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
