"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  showEmptyOption?: boolean;
  ariaLabel?: string;
}

export function Select({ value, options, onChange, placeholder = "—", showEmptyOption = true, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = `${useId()}-listbox`;

  const selected = options.find((o) => o.value === value);

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const minWidth = Math.max(rect.width, 130);
    const width = Math.min(minWidth, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(320, Math.max(96, availableSpace - 8));

    setDropdownStyle({
      position: "fixed",
      left,
      width,
      maxWidth: window.innerWidth - viewportPadding * 2,
      maxHeight,
      overflowY: "auto",
      zIndex: 9999,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedTrigger && !clickedDropdown) {
        setOpen(false);
      }
    }
    function onScroll() { setOpen(false); }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  function pick(val: string) {
    onChange(val);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openDropdown();
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          id={listboxId}
          style={dropdownStyle}
          role="listbox"
          aria-label={ariaLabel ?? placeholder}
          className="rounded-2xl border border-border bg-[#161616] shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden overscroll-contain animate-select-open"
        >
          <div className="p-1">
            {showEmptyOption && (
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                onClick={() => pick("")}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-xl transition-colors flex items-center gap-2 ${
                  value === ""
                    ? "bg-white/[0.08] text-white"
                    : "text-muted hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className={`w-3 h-3 flex-shrink-0 transition-opacity ${value === "" ? "opacity-100 text-accent" : "opacity-0"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 6l3.5 3.5L11 2" />
                </svg>
                <span>{placeholder}</span>
              </button>
            )}
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={value === o.value}
                onClick={() => pick(o.value)}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-xl transition-colors flex items-center gap-2 ${
                  value === o.value
                    ? "bg-white/[0.08] text-white"
                    : "text-muted hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className={`w-3 h-3 flex-shrink-0 transition-opacity ${value === o.value ? "opacity-100 text-accent" : "opacity-0"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 6l3.5 3.5L11 2" />
                </svg>
                <span>{o.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label ?? placeholder}` : undefined}
        onKeyDown={onTriggerKeyDown}
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors sm:min-w-[100px] justify-between ${
          open
            ? "border-accent text-white bg-white/[0.07]"
            : "border-border text-muted bg-white/[0.03] hover:border-border-strong hover:text-white"
        }`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className={`w-2.5 h-2.5 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
