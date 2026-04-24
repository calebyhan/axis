"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-white/[0.02] animate-pulse" /> }
);

export function LeafletMapWrapper({
  polyline,
  className,
  interactive = true,
  fitPadding,
}: {
  polyline: string;
  className?: string;
  interactive?: boolean;
  fitPadding?: number;
}) {
  return (
    <LeafletMap
      polyline={polyline}
      className={className}
      interactive={interactive}
      fitPadding={fitPadding}
    />
  );
}
