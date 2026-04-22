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
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-surface border-r border-border fixed top-0 left-0 z-50">
      <div className="px-6 py-8">
        <h1 className="text-lg font-semibold tracking-tight">Axis</h1>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[#1F1F1F] text-white"
                  : "text-muted hover:text-white hover:bg-[#1A1A1A]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
