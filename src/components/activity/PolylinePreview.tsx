import { decodePolyline, polylineToSvgPath } from "@/lib/polyline";

export function PolylinePreview({ polyline }: { polyline: string }) {
  const points = decodePolyline(polyline);
  const d = polylineToSvgPath(points, 300, 112, 10);
  if (!d) return null;

  return (
    <svg
      viewBox="0 0 300 112"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--accent, #3b82f6)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
