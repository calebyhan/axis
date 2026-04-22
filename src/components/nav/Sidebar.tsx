"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/activity", label: "Activity" },
  { href: "/log", label: "Log" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:block fixed top-4 left-4 bottom-4 w-60 z-50">
      <div className="card h-full flex flex-col px-4 py-5">
        <div className="px-3 py-3">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/40 mb-2">Axis</div>
          <h1 className="text-2xl font-semibold tracking-[-0.05em]">Training OS</h1>
          <p className="text-sm text-muted mt-2">Matte black tracking for lifting, running, and recovery.</p>
        </div>
        <nav className="flex flex-col gap-1 px-1 pt-4 flex-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                  active
                    ? "bg-white/[0.08] text-white border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-white/58 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {tab.label}
                <span className={`h-2 w-2 rounded-full ${active ? "bg-accent" : "bg-white/10"}`} />
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
