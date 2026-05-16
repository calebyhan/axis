"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/onboarding/actions";
import { ACCENT_COLORS } from "@/lib/accent-colors";
import type { AccentColor } from "@/types";

interface Props {
  initialDisplayName: string;
  initialAccent: AccentColor;
  nextPath: string;
}

const INSTALL_STEPS = {
  ios: [
    "Open Axis in Safari.",
    "Tap the Share button.",
    "Choose Add to Home Screen.",
    "Tap Add.",
  ],
  android: [
    "Open Axis in Chrome.",
    "Tap Install app if prompted, or open the browser menu.",
    "Choose Add to Home screen or Install app.",
    "Confirm Install.",
  ],
};

export function OnboardingClient({ initialDisplayName, initialAccent, nextPath }: Props) {
  const { push, refresh } = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [accent, setAccent] = useState<AccentColor>(initialAccent);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  function chooseAccent(nextAccent: AccentColor) {
    setAccent(nextAccent);
  }

  function handleContinue() {
    setError("");
    startTransition(async () => {
      const result = await completeOnboarding({
        display_name: displayName,
        accent_color: accent,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      push(nextPath);
      refresh();
    });
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-10">
      <main className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col gap-6">
        <header className="pt-top">
          <div className="page-kicker">Axis</div>
          <h1 className="max-w-3xl text-[2.7rem] font-semibold leading-none tracking-normal sm:text-[4rem]">
            Finish setup
          </h1>
          <p className="page-subtitle">
            Add Axis to your home screen, then personalize how the app greets you.
          </p>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-normal">Install the app</h2>
                <p className="mt-1 text-sm text-muted">
                  Axis works best from your home screen.
                </p>
              </div>
              <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-white/[0.04] text-accent sm:flex">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="7" y="2.75" width="10" height="18.5" rx="2.2" />
                  <path d="M10 18.25h4" />
                </svg>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <InstallInstructions title="iPhone / iPad" steps={INSTALL_STEPS.ios} />
              <InstallInstructions title="Android" steps={INSTALL_STEPS.android} />
            </div>
          </section>

          <section className="card flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold tracking-normal">Personalize</h2>
              <p className="mt-1 text-sm text-muted">These can be changed later in Settings.</p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                placeholder="What should Axis call you?"
                className="glass-input"
              />
            </label>

            <div className="flex flex-col gap-3">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/45">Accent color</div>
              <div className="grid grid-cols-4 gap-3" role="group" aria-label="Accent color">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    aria-label={`${color.label} accent color`}
                    aria-pressed={accent === color.value}
                    onClick={() => chooseAccent(color.value)}
                    className={`flex aspect-square items-center justify-center rounded-2xl border transition-all ${
                      accent === color.value
                        ? "border-white bg-white/[0.08]"
                        : "border-border bg-white/[0.03] hover:border-border-strong"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="size-8 rounded-full border border-white/20"
                      style={{ background: color.hex }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleContinue}
              disabled={isPending}
              className="glass-button glass-button-primary mt-auto w-full text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Continue to Axis"}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}

function InstallInstructions({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="card-soft p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-white/72">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs text-white/55">
              {index + 1}
            </span>
            <span className="leading-6">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
