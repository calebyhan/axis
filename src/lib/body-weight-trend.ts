export type WeightTrend = "gaining" | "maintaining" | "losing";

export function classifyTrend(
  readings: { date: Date; weight: number }[]
): WeightTrend {
  if (readings.length < 3) return "maintaining";

  const n = readings.length;
  // Convert dates to days from first reading
  const t0 = readings[0].date.getTime();
  const xs = readings.map((r) => (r.date.getTime() - t0) / (1000 * 60 * 60 * 24));
  const ys = readings.map((r) => r.weight);

  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }

  if (den === 0) return "maintaining";

  const slopePerDay = num / den;
  const slopePerWeek = slopePerDay * 7;

  if (slopePerWeek > 0.2) return "gaining";
  if (slopePerWeek < -0.2) return "losing";
  return "maintaining";
}
