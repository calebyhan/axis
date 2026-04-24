"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/lib/polyline";

interface Props {
  polyline: string;
  className?: string;
  interactive?: boolean;
  fitPadding?: number;
}

export function LeafletMap({
  polyline,
  className = "",
  interactive = true,
  fitPadding = 24,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track map instance to clean up on unmount
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const points = decodePolyline(polyline);
      if (points.length < 2) return;

      const map = L.map(containerRef.current, {
        zoomControl: interactive,
        attributionControl: false,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);

      // Read accent color from CSS custom property
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim() || "#3b82f6";

      const latlngs = points as [number, number][];
      const route = L.polyline(latlngs, {
        color: accent,
        weight: 3,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      });
      route.addTo(map);

      // Start marker
      L.circleMarker(latlngs[0], {
        radius: 5,
        color: accent,
        fillColor: "#0a0a0a",
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);

      // End marker
      L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 5,
        color: accent,
        fillColor: accent,
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);

      map.fitBounds(route.getBounds(), { padding: [fitPadding, fitPadding] });

      // Leaflet can mis-measure maps that mount into animated or freshly opened containers.
      requestAnimationFrame(() => {
        map.invalidateSize();
        map.fitBounds(route.getBounds(), { padding: [fitPadding, fitPadding] });
      });

      if (interactive) {
        map.dragging.enable();
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        map.touchZoom.enable();
      } else {
        map.dragging.disable();
        map.scrollWheelZoom.disable();
        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        map.touchZoom.disable();
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [fitPadding, interactive, polyline]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}
