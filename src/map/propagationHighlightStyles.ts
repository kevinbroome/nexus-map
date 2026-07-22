export const PROPAGATION_HIGHLIGHT_STYLES = {
  seed: {
    borderColor: "#ea580c",
    borderWeight: 3,
    fillOpacity: 0.95,
  },
  affected: {
    borderColor: "#2563eb",
    borderWeight: 3,
    fillOpacity: 0.9,
  },
  created: {
    borderColor: "#0891b2",
    borderWeight: 3,
    fillOpacity: 0.85,
  },
  traversed: {
    borderColor: "#94a3b8",
    borderWeight: 2,
    fillOpacity: 0.7,
  },
  blocked: {
    borderColor: "#dc2626",
    borderWeight: 2,
    fillOpacity: 0.55,
  },
} as const;

export type PropagationHighlightRole = keyof typeof PROPAGATION_HIGHLIGHT_STYLES;
