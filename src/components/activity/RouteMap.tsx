"use client";

import { useMemo } from "react";
import { decodePolyline, polylineToSvgPath } from "@/lib/polyline";

interface Props {
  polyline: string;
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
  strokeColor?: string;
}

export function RouteMap({
  polyline,
  width = 400,
  height = 220,
  className = "",
  strokeWidth = 2,
  strokeColor = "var(--accent)",
}: Props) {
  const path = useMemo(() => {
    try {
      const points = decodePolyline(polyline);
      return polylineToSvgPath(points, width, height, 12);
    } catch {
      return "";
    }
  }, [polyline, width, height]);

  if (!path) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
  );
}

// Thumbnail variant — tighter padding, thinner line, used in feed cards
export function RouteThumbnail({ polyline, className = "" }: { polyline: string; className?: string }) {
  return (
    <RouteMap
      polyline={polyline}
      width={300}
      height={120}
      className={className}
      strokeWidth={1.5}
    />
  );
}
