"use client";

import { useEffect, useRef, useState } from "react";
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
}

export function Select({ value, options, onChange, placeholder = "—" }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  function openDropdown() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 130),
      zIndex: 9999,
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
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  function pick(val: string) {
    onChange(val);
    setOpen(false);
  }

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded-2xl border border-border bg-[#161616] shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden animate-select-open"
        >
          <div className="p-1">
            <button
              type="button"
              onClick={() => pick("")}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-xl transition-colors ${
                value === ""
                  ? "bg-white/[0.08] text-white"
                  : "text-muted hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {placeholder}
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-xl transition-colors flex items-center gap-2 ${
                  value === o.value
                    ? "bg-white/[0.08] text-white"
                    : "text-muted hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <svg
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
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors min-w-[100px] justify-between ${
          open
            ? "border-accent text-white bg-white/[0.07]"
            : "border-border text-muted bg-white/[0.03] hover:border-border-strong hover:text-white"
        }`}
      >
        <span>{selected?.label ?? placeholder}</span>
        <svg
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
