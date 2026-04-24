"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#0a0a0a]" /> }
);

export function RouteMapExpandable({ polyline }: { polyline: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <div className="relative w-full h-full group">
        <div className="w-full h-full pointer-events-none" aria-hidden="true">
          <LeafletMap polyline={polyline} interactive={false} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
        <button
          type="button"
          className="absolute inset-0 z-[700] appearance-none border-0 rounded-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-inset"
          onClick={() => setOpen(true)}
          aria-label="Open interactive route map"
        />
      </div>

      {mounted && open &&
        createPortal(
          <div
            className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Interactive route map"
          >
            <div
              className="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-white/10 bg-[#050505] shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
              style={{ height: "70vh" }}
              onClick={(e) => e.stopPropagation()}
            >
              <LeafletMap key={`modal-${polyline}`} polyline={polyline} interactive={true} />
              <button
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 z-[1000] bg-black/70 backdrop-blur-sm border border-white/10 text-white/80 rounded-full w-8 h-8 flex items-center justify-center hover:text-white transition-colors text-sm"
                aria-label="Close map"
              >
                ✕
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
