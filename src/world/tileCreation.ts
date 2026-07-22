import { getTileId, tileExists } from "./coordinates";
import type { TerrainType, WorldState } from "./worldTypes";
import { normalizeMapTile } from "./tileUtils";

const CARDINAL_OFFSETS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

export function createTile(
  world: WorldState,
  coordinate: { x: number; y: number },
  terrain: TerrainType = "empty",
): WorldState {
  if (tileExists(world, coordinate.x, coordinate.y)) {
    throw new Error(
      `A tile already exists at ${coordinate.x},${coordinate.y}.`,
    );
  }

  const id = getTileId(coordinate.x, coordinate.y);

  return {
    ...world,
    tiles: {
      ...world.tiles,
      [id]: normalizeMapTile({
        id,
        x: coordinate.x,
        y: coordinate.y,
        terrain,
        tags: [],
        properties: {},
      }),
    },
  };
}

export function isBoundaryTile(world: WorldState, tileId: string): boolean {
  const tile = world.tiles[tileId];

  if (!tile) {
    return false;
  }

  return getMissingCardinalNeighbours(world, tileId).length > 0;
}

export function getMissingCardinalNeighbours(
  world: WorldState,
  tileId: string,
): Array<{ x: number; y: number }> {
  const tile = world.tiles[tileId];

  if (!tile) {
    return [];
  }

  const missing: Array<{ x: number; y: number }> = [];

  for (const offset of CARDINAL_OFFSETS) {
    const x = tile.x + offset.x;
    const y = tile.y + offset.y;

    if (!tileExists(world, x, y)) {
      missing.push({ x, y });
    }
  }

  return missing;
}

export function getFirstMissingCardinalNeighbour(
  world: WorldState,
  tileId: string,
): { x: number; y: number } | null {
  return getMissingCardinalNeighbours(world, tileId)[0] ?? null;
}

export { CARDINAL_OFFSETS };
