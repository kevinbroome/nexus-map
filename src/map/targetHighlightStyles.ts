export const TARGET_HIGHLIGHT_STYLES = {
  origin: {
    borderColor: "#b45309",
    borderWeight: 3,
  },
  destination: {
    borderColor: "#15803d",
    borderWeight: 3,
  },
  candidate: {
    borderColor: "#64748b",
    borderWeight: 2,
    fillOpacity: 0.75,
  },
  filteredOut: {
    borderColor: "#94a3b8",
    borderWeight: 1,
    fillOpacity: 0.45,
  },
  selected: {
    borderColor: "#c2410c",
    borderWeight: 3,
  },
  expanded: {
    borderColor: "#2563eb",
    borderWeight: 3,
    fillOpacity: 0.85,
  },
  primarySelection: {
    borderColor: "#ea580c",
    borderWeight: 3,
  },
  secondarySelection: {
    borderColor: "#16a34a",
    borderWeight: 3,
  },
} as const;

export type TargetHighlightRole = keyof typeof TARGET_HIGHLIGHT_STYLES;
