"use client";

import { useState } from "react";
import { LogRunPanel } from "@/components/log/LogRunPanel";
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
          <h1 className="page-title">Log</h1>
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
            <div className="text-sm text-muted mt-1">Import from Strava or enter manually.</div>
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

      {panel === "run" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:bg-black/60 md:items-center md:justify-center md:p-6">
          <div className="flex flex-col w-full h-full md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-3xl md:bg-[#0A0A0A] md:border md:border-[#1F1F1F] md:overflow-hidden">
            <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
              <button
                onClick={() => setPanel(null)}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <h2 className="flex-1 font-semibold">Log Run</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-nav md:pb-6">
              <LogRunPanel onSave={() => onSaved("Run saved!")} />
            </div>
          </div>
        </div>
      )}

      {panel === "weight" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:bg-black/60 md:items-center md:justify-center md:p-6">
          <div className="flex flex-col w-full h-full md:h-auto md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-3xl md:bg-[#0A0A0A] md:border md:border-[#1F1F1F] md:overflow-hidden">
            <div className="flex items-center gap-3 px-4 pb-4 border-b border-border" style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
              <button
                onClick={() => setPanel(null)}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <h2 className="flex-1 font-semibold">Body Weight</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-nav md:pb-6">
              <LogWeightForm onSave={() => onSaved("Weight logged!")} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
