export const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    background: "#111111",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 8,
    color: "#f5f5f5",
    fontSize: 12,
    boxShadow: "none",
  },
  itemStyle: { color: "#d4d4d4" },
  labelStyle: { color: "rgba(255, 255, 255, 0.45)" },
  cursor: { fill: "rgba(255, 255, 255, 0.04)", stroke: "rgba(255, 255, 255, 0.08)" },
};

export const CHART_LINE_TOOLTIP_PROPS = {
  ...CHART_TOOLTIP_PROPS,
  cursor: { stroke: "rgba(255, 255, 255, 0.18)", strokeWidth: 1 },
};

