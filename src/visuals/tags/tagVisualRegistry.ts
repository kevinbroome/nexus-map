import type { MapVisualTheme } from "../theme";
import type { MapTile } from "../../world/worldTypes";

export interface TileVisualOverlay {
  id: string;
  type: "pattern" | "symbol" | "image" | "border" | "tint";
  value: string;
  opacity?: number;
  rotation?: number;
  scale?: number;
  createdTurn?: number;
  createdByCardId?: string;
}

export interface ResolvedTileVisual {
  layer: "pattern" | "symbol" | "border" | "tint";
  patternId?: string;
  symbol?: string;
  borderColor?: string;
  borderWeight?: number;
  borderDashArray?: string;
  tintColor?: string;
  tintOpacity?: number;
  opacity: number;
}

export interface TagVisualDefinition {
  overlays: Omit<ResolvedTileVisual, "opacity">[];
  labelTreatment?: "normal" | "faded" | "broken";
}

export const TAG_VISUAL_REGISTRY: Record<string, TagVisualDefinition> = {
  ash: {
    overlays: [{ layer: "pattern", patternId: "desert-dots" }],
  },
  protected: {
    overlays: [
      {
        layer: "border",
        borderColor: "#ca8a04",
        borderWeight: 2,
      },
    ],
  },
  frontier: {
    overlays: [
      {
        layer: "border",
        borderColor: "#78716c",
        borderWeight: 1,
        borderDashArray: "4 3",
      },
    ],
  },
  forgotten: {
    overlays: [{ layer: "tint", tintColor: "#94a3b8", tintOpacity: 0.35 }],
    labelTreatment: "faded",
  },
  altered: {
    overlays: [{ layer: "symbol", symbol: "✦" }],
  },
  ruined: {
    overlays: [{ layer: "pattern", patternId: "ruin-broken" }],
  },
  "road-blocked": {
    overlays: [{ layer: "symbol", symbol: "✕" }],
  },
};

export function resolveTileVisualLayers(
  tile: MapTile,
  theme: MapVisualTheme,
): ResolvedTileVisual[] {
  void theme;
  const resolved: ResolvedTileVisual[] = [];

  for (const tag of tile.tags) {
    const definition = TAG_VISUAL_REGISTRY[tag];

    if (!definition) {
      continue;
    }

    for (const overlay of definition.overlays) {
      resolved.push({ ...overlay, opacity: overlay.patternId ? 0.25 : 0.5 });
    }
  }

  if (tile.settlement?.type === "ruin" && !tile.tags.includes("ruined")) {
    const ruinDef = TAG_VISUAL_REGISTRY.ruined;

    if (ruinDef) {
      for (const overlay of ruinDef.overlays) {
        resolved.push({ ...overlay, opacity: 0.3 });
      }
    }
  }

  return resolved;
}

export function getTagLabelTreatment(
  tile: MapTile,
): TagVisualDefinition["labelTreatment"] {
  for (const tag of tile.tags) {
    const treatment = TAG_VISUAL_REGISTRY[tag]?.labelTreatment;

    if (treatment) {
      return treatment;
    }
  }

  return "normal";
}
