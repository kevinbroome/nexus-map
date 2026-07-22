import { getTileId, tileExists } from "./coordinates";
import { getMissingNeighbourCoordinates } from "./neighbours";
import type { TerrainType, WorldState } from "./worldTypes";
import { normalizeMapTile } from "./tileUtils";

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
  return getMissingNeighbourCoordinates(world, tileId, "cardinal");
}

export function getFirstMissingCardinalNeighbour(
  world: WorldState,
  tileId: string,
): { x: number; y: number } | null {
  return getMissingCardinalNeighbours(world, tileId)[0] ?? null;
}
