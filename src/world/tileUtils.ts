import type { MapTile, WorldAction } from "./worldTypes";

export function cloneTile(tile: MapTile): MapTile {
  return structuredClone(tile);
}

export function normalizeMapTile(tile: MapTile): MapTile {
  return {
    ...tile,
    tags: tile.tags ?? [],
    properties: tile.properties ?? {},
  };
}

export function normalizeWorldAction(action: WorldAction): WorldAction {
  return {
    ...action,
    randomSeed: action.randomSeed ?? "",
    resolvedValues: action.resolvedValues ?? {},
    changes: action.changes.map((change) => ({
      tileId: change.tileId,
      before: normalizeMapTile(change.before),
      after: normalizeMapTile(change.after),
    })),
  };
}

export function tilesAreEqual(left: MapTile, right: MapTile): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
