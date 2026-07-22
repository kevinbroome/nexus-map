import type { MapTile, Settlement, WorldAction } from "./worldTypes";
import { isRuinSettlement, isVillageSettlement } from "./worldTypes";
import type { TargetResolutionRecord } from "../rules/targeting/types";

export function cloneTile(tile: MapTile): MapTile {
  return structuredClone(tile);
}

function normalizeSettlement(settlement: unknown): Settlement | undefined {
  if (!settlement || typeof settlement !== "object") {
    return undefined;
  }

  const value = settlement as Record<string, unknown>;

  if (value.type === "ruin") {
    return {
      type: "ruin",
      formerType: "village",
      ruinedAtTurn: Number(value.ruinedAtTurn ?? 0),
    };
  }

  if (value.type === "village") {
    return {
      type: "village",
      inhospitableTurns: Number(value.inhospitableTurns ?? 0),
      ...(typeof value.name === "string" ? { name: value.name } : {}),
    };
  }

  if (value.type === "town" || value.type === "city") {
    return {
      type: "village",
      inhospitableTurns: 0,
      ...(typeof value.name === "string" ? { name: value.name } : {}),
    };
  }

  return undefined;
}

export function normalizeMapTile(tile: MapTile): MapTile {
  return {
    ...tile,
    settlement: normalizeSettlement(tile.settlement),
    tags: tile.tags ?? [],
    properties: tile.properties ?? {},
  };
}

function createEmptyTargetResolutionRecord(): TargetResolutionRecord {
  return {
    originIds: [],
    destinationIds: [],
    selectedIds: [],
    expandedTargetIds: [],
    resolvedValues: {},
  };
}

export function normalizeWorldAction(action: WorldAction): WorldAction {
  return {
    ...action,
    randomSeed: action.randomSeed ?? "",
    resolvedValues: action.resolvedValues ?? {},
    targetResolution: action.targetResolution ?? {
      ...createEmptyTargetResolutionRecord(),
      expandedTargetIds: [...action.targetIds],
    },
    turn: action.turn ?? 0,
    consequences: action.consequences ?? [],
    regionChanges: action.regionChanges ?? [],
    routeChanges: action.routeChanges ?? [],
    changes: action.changes.map((change) => ({
      tileId: change.tileId,
      before: change.before ? normalizeMapTile(change.before) : null,
      after: normalizeMapTile(change.after),
    })),
  };
}

export function tilesAreEqual(left: MapTile, right: MapTile): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createVillageSettlement(name?: string): Settlement {
  return {
    type: "village",
    inhospitableTurns: 0,
    ...(name ? { name } : {}),
  };
}

export { isRuinSettlement, isVillageSettlement };
