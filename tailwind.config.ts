import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        surface: "rgba(18, 18, 18, 0.72)",
        border: "rgba(255, 255, 255, 0.1)",
        "chart-axis": "rgba(255, 255, 255, 0.14)",
        muted: "#9A9A9A",
        accent: {
          blue: "#3B82F6",
          green: "#22C55E",
          orange: "#F97316",
          purple: "#A855F7",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
