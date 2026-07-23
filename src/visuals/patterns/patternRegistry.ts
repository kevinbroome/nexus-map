export interface MapPatternDefinition {
  id: string;
  type: "dots" | "lines" | "crosshatch" | "noise" | "symbols";
  spacing: number;
  opacity: number;
  rotation?: number;
  scale?: number;
  stroke?: string;
  fill?: string;
}

export const MAP_PATTERNS: Record<string, MapPatternDefinition> = {
  "forest-stipple": {
    id: "forest-stipple",
    type: "dots",
    spacing: 6,
    opacity: 0.22,
    stroke: "#3d4f3f",
  },
  "mountain-angular": {
    id: "mountain-angular",
    type: "lines",
    spacing: 8,
    opacity: 0.25,
    rotation: 45,
    stroke: "#5c554d",
  },
  "desert-dots": {
    id: "desert-dots",
    type: "dots",
    spacing: 10,
    opacity: 0.18,
    stroke: "#9a8458",
  },
  "urban-grid": {
    id: "urban-grid",
    type: "crosshatch",
    spacing: 7,
    opacity: 0.2,
    stroke: "#7a6d62",
  },
  "chasm-fracture": {
    id: "chasm-fracture",
    type: "crosshatch",
    spacing: 4,
    opacity: 0.35,
    stroke: "#1a1612",
  },
  "ruin-broken": {
    id: "ruin-broken",
    type: "symbols",
    spacing: 12,
    opacity: 0.28,
    stroke: "#6b6358",
  },
  "paper-noise": {
    id: "paper-noise",
    type: "noise",
    spacing: 3,
    opacity: 0.06,
    stroke: "#8a7f6e",
  },
};

export function getPatternDefinition(id: string): MapPatternDefinition | undefined {
  return MAP_PATTERNS[id];
}

export function getAllPatternDefinitions(): MapPatternDefinition[] {
  return Object.values(MAP_PATTERNS);
}
