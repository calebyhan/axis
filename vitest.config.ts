import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/lib/adherence.ts",
        "src/lib/body-weight-trend.ts",
        "src/lib/checklist.ts",
        "src/lib/e1rm.ts",
        "src/lib/planner.ts",
        "src/lib/polyline.ts",
        "src/lib/splits.ts",
        "src/lib/strava/activity-row.ts",
        "src/lib/training-load.ts",
        "src/lib/units.ts",
      ],
    },
  },
});
