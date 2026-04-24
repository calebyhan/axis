// Google encoded polyline decoder (RFC algorithm).
// Returns array of [lat, lng] pairs.
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

// Convert decoded lat/lng points to a normalized SVG path string.
// viewBox is "0 0 {width} {height}"; padding adds whitespace around the route.
export function polylineToSvgPath(
  points: [number, number][],
  width: number,
  height: number,
  padding = 10
): string {
  if (points.length < 2) return "";

  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  const usableW = width - padding * 2;
  const usableH = height - padding * 2;

  // Preserve aspect ratio
  const scale = Math.min(usableW / lngRange, usableH / latRange);
  const offsetX = (usableW - lngRange * scale) / 2 + padding;
  const offsetY = (usableH - latRange * scale) / 2 + padding;

  const svgPoints = points.map(([lat, lng]) => {
    const x = (lng - minLng) * scale + offsetX;
    const y = (maxLat - lat) * scale + offsetY; // invert Y axis
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return "M" + svgPoints.join("L");
}
