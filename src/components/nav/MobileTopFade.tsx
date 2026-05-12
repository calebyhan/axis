"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function MobileTopFade() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let raf = 0;

    function update() {
      raf = 0;
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const opacity = Math.min(Math.max((scrollY - 2) / 24, 0), 1);
      node.style.setProperty("--mobile-top-fade-opacity", opacity.toFixed(3));
    }

    function queueUpdate() {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", queueUpdate, { passive: true });
    window.addEventListener("resize", queueUpdate);
    window.addEventListener("pageshow", queueUpdate);

    const routeFrame = window.requestAnimationFrame(queueUpdate);

    return () => {
      window.cancelAnimationFrame(routeFrame);
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queueUpdate);
      window.removeEventListener("resize", queueUpdate);
      window.removeEventListener("pageshow", queueUpdate);
    };
  }, [pathname]);

  return <div ref={ref} aria-hidden="true" className="mobile-top-fade" />;
}
