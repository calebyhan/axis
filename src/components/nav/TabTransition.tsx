"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const TAB_ORDER = ["/dashboard", "/activity", "/log", "/stats", "/settings"];

// Module-level: persists across renders within the same browser session
let prevTabIndex = -1;

function getAnimClass(pathname: string): string {
  const curr = TAB_ORDER.findIndex((t) => pathname.startsWith(t));
  if (curr === -1 || prevTabIndex === -1) return "";
  if (curr > prevTabIndex) return "tab-slide-right";
  if (curr < prevTabIndex) return "tab-slide-left";
  return "";
}

export function TabTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const animClass = getAnimClass(pathname);

  // Update prevTabIndex after each render so next navigation computes correct direction
  useEffect(() => {
    const curr = TAB_ORDER.findIndex((t) => pathname.startsWith(t));
    if (curr !== -1) prevTabIndex = curr;
  });

  return (
    <div key={pathname} className={animClass}>
      {children}
    </div>
  );
}
