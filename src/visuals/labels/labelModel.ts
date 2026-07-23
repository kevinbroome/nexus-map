import type { MapDetailLevel } from "../theme";
import type { SettlementRegion, WorldState } from "../../world/worldTypes";
import { detailLevelAtLeast } from "../detailLevel";

export interface MapLabel {
  id: string;
  text: string;
  tileId: string;
  type: "settlement" | "region" | "route" | "story" | "custom";
  priority: number;
  minimumDetailLevel: MapDetailLevel;
}

export interface LabelPlacementOptions {
  detailLevel: MapDetailLevel;
  selectedTileIds?: string[];
  maxLabels?: number;
}

function regionLabelPriority(tier: SettlementRegion["tier"]): number {
  switch (tier) {
    case "sunder":
      return 100;
    case "quadrant":
      return 90;
    case "urban-region":
      return 80;
    case "expanse":
      return 70;
    case "town":
      return 60;
    default:
      return 50;
  }
}

export function buildMapLabels(world: WorldState): MapLabel[] {
  const labels: MapLabel[] = [];

  for (const region of Object.values(world.settlementRegions)) {
    labels.push({
      id: `region:${region.id}`,
      text: region.tier.replace("-", " "),
      tileId: region.anchorTileId,
      type: "region",
      priority: regionLabelPriority(region.tier),
      minimumDetailLevel:
        region.tier === "town" || region.tier === "expanse"
          ? "regional"
          : "world",
    });
  }

  for (const tile of Object.values(world.tiles)) {
    if (tile.settlement?.type === "village") {
      labels.push({
        id: `village:${tile.id}`,
        text: tile.settlement.name ?? "village",
        tileId: tile.id,
        type: "settlement",
        priority: 40,
        minimumDetailLevel: "local",
      });
    }

    if (tile.settlement?.type === "ruin") {
      labels.push({
        id: `ruin:${tile.id}`,
        text: "ruin",
        tileId: tile.id,
        type: "settlement",
        priority: 35,
        minimumDetailLevel: "regional",
      });
    }
  }

  labels.sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return left.id.localeCompare(right.id);
  });

  return labels;
}

export function resolveVisibleLabels(
  labels: MapLabel[],
  options: LabelPlacementOptions,
): MapLabel[] {
  const selected = new Set(options.selectedTileIds ?? []);
  const maxLabels = options.maxLabels ?? 24;
  const visible: MapLabel[] = [];
  const occupiedTiles = new Set<string>();

  for (const label of labels) {
    if (!detailLevelAtLeast(options.detailLevel, label.minimumDetailLevel)) {
      continue;
    }

    if (selected.has(label.tileId)) {
      visible.push(label);
      occupiedTiles.add(label.tileId);
    }
  }

  for (const label of labels) {
    if (visible.length >= maxLabels) {
      break;
    }

    if (!detailLevelAtLeast(options.detailLevel, label.minimumDetailLevel)) {
      continue;
    }

    if (occupiedTiles.has(label.tileId)) {
      continue;
    }

    visible.push(label);
    occupiedTiles.add(label.tileId);
  }

  return visible;
}
