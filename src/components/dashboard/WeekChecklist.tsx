"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChecklistDay, ChecklistSlot } from "@/lib/checklist";
import type { DayType } from "@/types";
import { upsertOverride, deleteOverride } from "@/app/(tabs)/dashboard/actions";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  items: ChecklistDay[];
  dayTypes: DayType[];
}

type SlotState = "done" | "pending" | "override-done" | "override-pending";
type SlotTone = "default" | "rest" | "skip";

function getSlotState(slot: ChecklistSlot, dayPassed: boolean): SlotState {
  // Skip override: completed once day has passed, silver until then
  if (slot.isOverridden && slot.effective === null) {
    return dayPassed ? "override-done" : "override-pending";
  }

  const effectiveType = slot.isOverridden ? slot.effective : slot.planned;
  const isRest = effectiveType?.name === "Rest";
  const isDone = !!slot.matched || (isRest && dayPassed);

  if (slot.isOverridden) return isDone ? "override-done" : "override-pending";
  return isDone ? "done" : "pending";
}

function getSlotTone(slot: ChecklistSlot): SlotTone {
  if (slot.isOverridden && slot.effective === null) return "skip";
  if ((slot.effective ?? slot.planned).name === "Rest") return "rest";
  return "default";
}

function Pill({
  slot,
  dayPassed,
  onClick,
}: {
  slot: ChecklistSlot;
  dayPassed: boolean;
  onClick: () => void;
}) {
  const state = getSlotState(slot, dayPassed);
  const tone = getSlotTone(slot);
  const isSkip = slot.isOverridden && slot.effective === null;
  const label = isSkip ? "Skip" : (slot.effective?.name ?? slot.planned.name);

  let cls =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer";
  let style: React.CSSProperties | undefined;

  if (state === "done") {
    if (tone === "rest") {
      cls += " text-sky-300";
      style = {
        borderColor: "rgba(125, 211, 252, 0.55)",
        backgroundColor: "rgba(14, 165, 233, 0.18)",
      };
    } else {
      style = {
        borderColor: "rgba(var(--accent-rgb), 0.55)",
        backgroundColor: "rgba(var(--accent-rgb), 0.18)",
        color: "var(--accent)",
      };
    }
  } else if (state === "override-done") {
    cls += " border-orange-500/55 bg-orange-500/[0.18] text-orange-300";
  } else if (state === "override-pending") {
    cls += " border-white/25 bg-white/[0.06] text-white/60";
  } else {
    cls += " border-white/10 bg-white/[0.03] text-white/40";
  }

  const showCheck = state === "done" || (state === "override-done" && !isSkip);
  const showSkipIcon = isSkip && state === "override-done";

  return (
    <button type="button" onClick={onClick} className={cls} style={style} aria-label={`Change ${slot.kind} plan: ${label}`}>
      {showCheck && (
        <svg aria-hidden="true" viewBox="0 0 10 8" fill="none" className="w-2.5 h-2 shrink-0">
          <path
            d="M1 4l2.5 2.5L9 1"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {showSkipIcon && (
        <svg aria-hidden="true" viewBox="0 0 10 2" fill="none" className="w-2.5 h-1 shrink-0">
          <path d="M1 1h8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      )}
      {label}
    </button>
  );
}

interface ModalProps {
  slot: ChecklistSlot;
  dayName: string;
  dayTypes: DayType[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (dayTypeId: string | null) => void;
  onReset: () => void;
}

function OverrideModal({ slot, dayName, dayTypes, isPending, error, onClose, onSelect, onReset }: ModalProps) {
  const relevantTypes = dayTypes.filter(
    (dt) => dt.category === slot.planned.category && dt.name !== "Rest"
  );

  const currentTypeId = slot.isOverridden
    ? (slot.effective?.id ?? null)
    : slot.planned.id;

  const isSkipSelected = slot.isOverridden && slot.effective === null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} role="dialog" aria-modal="true" aria-labelledby="schedule-override-title">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#141414] border border-white/10 p-5 pb-8 sm:pb-5"
        role="document"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{dayName}</p>
            <p id="schedule-override-title" className="text-sm font-medium text-white mt-0.5">
              Override {slot.kind === "workout" ? "workout" : "cardio"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule override"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white/70 transition-colors"
          >
            <svg aria-hidden="true" viewBox="0 0 10 10" fill="none" className="w-3 h-3">
              <path d="M1 9L9 1M1 1l8 8" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {relevantTypes.map((dt) => {
            const isSelected = currentTypeId === dt.id;
            const isPlanned = dt.id === slot.planned.id;
            return (
              <button
                key={dt.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isPending}
                onClick={() => onSelect(dt.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span>{dt.name}</span>
                {isPlanned && !slot.isOverridden && (
                  <span className="text-xs text-white/25">planned</span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={isSkipSelected}
            disabled={isPending}
            onClick={() => onSelect(null)}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
              isSkipSelected
                ? "bg-white/10 text-white/60 font-medium"
                : "text-white/35 hover:bg-white/5 hover:text-white/55"
            }`}
          >
            Skip this day
          </button>
        </div>

        {slot.isOverridden && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <button
              type="button"
              disabled={isPending}
              onClick={onReset}
              className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors py-1"
            >
              Reset to planned ({slot.planned.name})
            </button>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export function WeekChecklist({ items, dayTypes }: Props) {
  const router = useRouter();
  const [modalSlot, setModalSlot] = useState<{ slot: ChecklistSlot; dayName: string } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return (
      <div className="card p-4 flex flex-col gap-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.24em] text-white/45">Planned sessions</span>
          <p className="mt-2 text-sm text-muted">No schedule set.</p>
        </div>
        <Link href="/settings" className="text-sm text-accent hover:opacity-80">
          Add schedule
        </Link>
      </div>
    );
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // Sun-first display: (dayOfWeek+1)%7 maps Sun(6)→0, Mon(0)→1, …, Sat(5)→6
  const ordered = [...items].sort((a, b) => (a.dayOfWeek + 1) % 7 - (b.dayOfWeek + 1) % 7);

  function handleSelect(dayTypeId: string | null) {
    if (!modalSlot) return;
    const { slot } = modalSlot;

    // Selecting planned type when override exists = reset; selecting when no override = no-op
    if (dayTypeId === slot.planned.id) {
      if (slot.isOverridden) {
        startTransition(async () => {
          const result = await deleteOverride(slot.date, slot.kind);
          if (result.error) {
            setModalError("Could not reset this plan. Please try again.");
            return;
          }
          setModalError(null);
          setModalSlot(null);
          router.refresh();
        });
      } else {
        setModalError(null);
        setModalSlot(null);
      }
      return;
    }

    startTransition(async () => {
      const result = await upsertOverride(slot.date, slot.kind, dayTypeId);
      if (result.error) {
        setModalError("Could not save this override. Please try again.");
        return;
      }
      setModalError(null);
      setModalSlot(null);
      router.refresh();
    });
  }

  function handleReset() {
    if (!modalSlot) return;
    const { slot } = modalSlot;
    startTransition(async () => {
      const result = await deleteOverride(slot.date, slot.kind);
      if (result.error) {
        setModalError("Could not reset this plan. Please try again.");
        return;
      }
      setModalError(null);
      setModalSlot(null);
      router.refresh();
    });
  }

  function openModal(slot: ChecklistSlot, dayName: string) {
    setModalError(null);
    setModalSlot({ slot, dayName });
  }

  return (
    <>
      <div className="card divide-y divide-white/5">
        <div className="px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.24em] text-white/45">Planned sessions</span>
        </div>
        {ordered.map((day) => {
          const dayPassed = day.date <= todayStr;
          const isToday = day.date === todayStr;
          return (
            <div key={day.dayOfWeek} className="flex items-center gap-3 px-4 py-3">
              <span className={`text-xs w-8 shrink-0 ${isToday ? "text-[#F6D365] font-medium" : "text-white/38"}`}>
                {DAY_NAMES[day.dayOfWeek]}
              </span>
              <div className="flex flex-wrap gap-2">
                {day.workout && (
                  <Pill
                    slot={day.workout}
                    dayPassed={dayPassed}
                    onClick={() => openModal(day.workout!, DAY_NAMES[day.dayOfWeek])}
                  />
                )}
                {day.cardio && (
                  <Pill
                    slot={day.cardio}
                    dayPassed={dayPassed}
                    onClick={() => openModal(day.cardio!, DAY_NAMES[day.dayOfWeek])}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalSlot && (
        <OverrideModal
          slot={modalSlot.slot}
          dayName={modalSlot.dayName}
          dayTypes={dayTypes}
          isPending={isPending}
          error={modalError}
          onClose={() => setModalSlot(null)}
          onSelect={handleSelect}
          onReset={handleReset}
        />
      )}
    </>
  );
}
